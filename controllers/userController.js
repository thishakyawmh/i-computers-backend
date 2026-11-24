import { json } from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import axios from "axios";
import nodemailer from "nodemailer";
import Otp from '../models/Otp.js';
dotenv.config();

const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    }
});

const JWT_SECRET = process.env.JWT_SECRET;

const sanitizeUserImages = (user) => {
    const userObj = user.toObject ? user.toObject() : user;
    const invalidPaths = ["/default.jpg", "/defualt.jpg", "https://ui-avatars.com", "User-Profile-PNG.png", "user-circle.svg"];

    if (userObj.image && invalidPaths.some(path => userObj.image.includes(path))) {
        userObj.image = null;
    }
    if (userObj.profileImage && invalidPaths.some(path => userObj.profileImage.includes(path))) {
        userObj.profileImage = null;
    }
    return userObj;
};

export async function createUser(req, res) {
    try {
        const data = req.body;
        const hashedPassword = bcrypt.hashSync(data.password, 10);
        const user = new User({
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            password: hashedPassword,
        });

        await user.save();
        res.json({ message: "User Created Successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error creating user", error: error.message });
    }
}

export async function loginUser(req, res) {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User Not Found" });
        }

        const isPasswordCorrect = bcrypt.compareSync(password, user.password);

        if (isPasswordCorrect) {
            const sanitizedUser = sanitizeUserImages(user);
            const payload = {
                email: sanitizedUser.email,
                firstName: sanitizedUser.firstName,
                lastName: sanitizedUser.lastName,
                role: sanitizedUser.role,
                isEmailVerified: sanitizedUser.isEmailVerified,
                image: sanitizedUser.image,
                profileImage: sanitizedUser.profileImage || sanitizedUser.image
            };

            const token = jwt.sign(payload, process.env.JWT_SECRET, {
                expiresIn: "150h"
            });

            res.json({
                message: "Login successful",
                token: token,
                role: user.role
            });
        } else {
            res.status(401).json({ message: "Password is incorrect" });
        }
    } catch (error) {
        res.status(500).json({ message: "Error logging in", error: error.message });
    }
}


export function isAdmin(req) {
    if (req.user == null) return false;
    if (req.user.role !== "admin") return false;
    return true;
}


export async function getUser(req, res) {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    try {
        const user = await User.findOne({ email: req.user.email });
        if (!user) {
            return res.status(404).json({ message: "User Not Found" });
        }
        res.json(sanitizeUserImages(user));
    } catch (error) {
        res.status(500).json({ message: "Error fetching user", error: error.message });
    }
}

export async function googleLogin(req, res) {
    const { token } = req.body;
    try {
        const googleRes = await axios.get(
            `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`
        );
        const { email, given_name, family_name, picture } = googleRes.data;
        let user = await User.findOne({ email: email });
        if (user) {
            user.profileImage = picture;
            user.image = picture;
            await user.save();
        } else {
            user = new User({
                firstName: given_name,
                lastName: family_name || "",
                email: email,
                profileImage: picture,
                image: picture,
                role: "customer",
                isEmailVerified: true,
                password: Math.random().toString(36).slice(-10)
            });
            await user.save();
        }

        const sanitizedUser = sanitizeUserImages(user);

        const localToken = jwt.sign(
            {
                email: sanitizedUser.email,
                role: sanitizedUser.role,
                firstName: sanitizedUser.firstName,
                lastName: sanitizedUser.lastName,
                profileImage: sanitizedUser.profileImage,
                image: sanitizedUser.image
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.json({
            message: "Success",
            token: localToken,
            user: sanitizedUser,
            role: sanitizedUser.role
        });
    } catch (error) {
        console.error("Google Login Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export async function sendOTP(req, res) {
    try {
        const email = String(req.body?.email || req.params.email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: 'A valid email address is required' });
        }

        const genericResponse = {
            message: 'If an account exists for that email, a verification code will be sent.'
        };
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(200).json(genericResponse);
        }

        await Otp.deleteMany({ email });
        const otpCode = crypto.randomInt(100000, 1000000).toString();
        const otp = new Otp({
            email,
            otp: otpCode,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            attempts: 0
        });
        await otp.save();

        try {
            await transporter.sendMail({
                from: process.env.EMAIL,
                to: email,
                subject: 'OTP Verification',
                text: `Your password reset code is ${otpCode}. It expires in 10 minutes.`
            });
        } catch (mailError) {
            await Otp.deleteMany({ email });
            console.error('Password reset email delivery failed');
            return res.status(500).json({ message: 'Unable to send a verification code right now' });
        }

        return res.status(200).json(genericResponse);
    } catch (error) {
        console.error('Password reset request failed:', error.message);
        return res.status(500).json({ message: 'Unable to process password reset request' });
    }
}

export async function validateOTAndUpdatePassword(req, res) {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const otpCode = String(req.body?.otpCode || '').trim();
        const password = req.body?.password;

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(otpCode)) {
            return res.status(400).json({ message: 'Invalid email address or verification code' });
        }
        if (typeof password !== 'string' || password.length < 12) {
            return res.status(400).json({ message: 'Password must be at least 12 characters long' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }

        const otp = await Otp.findOne({ email });
        if (!otp || !otp.expiresAt || otp.expiresAt.getTime() <= Date.now()) {
            await Otp.deleteMany({ email });
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }

        if (otp.attempts >= 5) {
            await Otp.deleteMany({ email });
            return res.status(429).json({ message: 'Too many incorrect attempts. Request a new code.' });
        }

        if (otp.otp !== otpCode) {
            otp.attempts += 1;
            if (otp.attempts >= 5) {
                await Otp.deleteMany({ email });
                return res.status(429).json({ message: 'Too many incorrect attempts. Request a new code.' });
            }
            await otp.save();
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }

        user.password = await bcrypt.hash(password, 12);
        await user.save();
        await Otp.deleteMany({ email });
        return res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Password update failed:', error.message);
        return res.status(500).json({ message: 'Unable to update password right now' });
    }
}

export function getAllUsers(req, res) {
    if (!isAdmin(req)) {
        return res.status(403).json({ message: "Forbidden" });
    }

    User.find().then((users) => {
        const sanitizedUsers = users.map(user => sanitizeUserImages(user));
        res.json(sanitizedUsers);
    }).catch((error) => {
        res.status(500).json({ message: "Error fetching users", error: error.message });
    });
}

export function updateUserByEmail(req, res) {
    if (!isAdmin(req)) {
        return res.status(403).json({ message: "Forbidden" });
    }

    const email = req.params.email;
    User.updateOne({ email: email }, req.body).then(() => {
        res.json({ message: "User updated successfully" });
    }).catch((error) => {
        res.status(500).json({ message: "Error updating user", error: error.message });
    });
}

export function deleteUserByEmail(req, res) {
    if (!isAdmin(req)) {
        return res.status(403).json({ message: "Forbidden" });
    }

    const email = req.params.email;
    User.deleteOne({ email: email }).then(() => {
        res.json({ message: "User deleted successfully" });
    }).catch((error) => {
        res.status(500).json({ message: "Error deleting user", error: error.message });
    });
}