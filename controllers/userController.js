import { json } from 'express';
import User from '../models/User.js';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import axios from "axios";
import nodemailer from "nodemailer";
import { randomInt, randomBytes } from "node:crypto";
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
    delete userObj.password;
    return userObj;
};

export async function createUser(req, res) {
    try {
        const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
        const firstName = typeof req.body.firstName === "string" ? req.body.firstName.trim() : "";
        const lastName = typeof req.body.lastName === "string" ? req.body.lastName.trim() : "";
        const password = req.body.password;

        if (!email || !firstName || !lastName || typeof password !== "string" || password.length < 12) {
            return res.status(400).json({ message: "Valid email, first name, last name, and a password of at least 12 characters are required" });
        }

        const existingUser = await User.findOne({ email }).select("_id");
        if (existingUser) {
            return res.status(409).json({ message: "An account with this email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({ email, firstName, lastName, password: hashedPassword });
        await user.save();
        return res.status(201).json({ message: "User created successfully" });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({ message: "An account with this email already exists" });
        }
        return res.status(500).json({ message: "Error creating user" });
    }
}

export async function loginUser(req, res) {
    try {
        const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
        const password = req.body.password;

        if (!email || typeof password !== "string" || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await User.findOne({ email });
        if (!user || user.isBlocked) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);

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

            const token = jwt.sign(payload, JWT_SECRET, {
                expiresIn: "24h",
                issuer: "i-computers-api",
                algorithm: "HS256"
            });

            res.json({
                message: "Login successful",
                token: token,
                role: user.role
            });
        } else {
            return res.status(401).json({ message: "Invalid email or password" });
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
                password: await bcrypt.hash(randomBytes(32).toString("hex"), 12)
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
            JWT_SECRET,
            { expiresIn: "24h", issuer: "i-computers-api", algorithm: "HS256" }
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
        const email = typeof req.params.email === "string" ? req.params.email.trim().toLowerCase() : "";
        if (!email) return res.status(400).json({ message: "Email is required" });

        const user = await User.findOne({ email });
        if (!user) {
            // Avoid exposing whether an account exists.
            return res.json({ message: "If the account exists, a verification code will be sent" });
        }

        const recentOtp = await Otp.findOne({ email });
        if (recentOtp?.createdAt && Date.now() - recentOtp.createdAt.getTime() < 60_000) {
            return res.status(429).json({ message: "Please wait before requesting another code" });
        }

        await Otp.deleteMany({ email });
        const otpCode = String(randomInt(100000, 1000000));
        const otp = new Otp({
            email,
            otpHash: await bcrypt.hash(otpCode, 10),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            attempts: 0
        });
        await otp.save();

        try {
            await transporter.sendMail({
                from: process.env.EMAIL,
                to: email,
                subject: "OTP Verification",
                text: `Your verification code is ${otpCode}. It expires in 10 minutes.`
            });
        } catch (mailError) {
            await Otp.deleteMany({ email });
            throw mailError;
        }

        return res.json({ message: "If the account exists, a verification code will be sent" });
    } catch (error) {
        console.error("OTP delivery failed:", error.message);
        return res.status(500).json({ message: "Unable to send verification code" });
    }
}

export async function validateOTAndUpdatePassword(req, res) {
    try {
        const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
        const otpCode = String(req.body.otpCode || "");
        const password = req.body.password;

        if (!email || !/^\\d{6}$/.test(otpCode) || typeof password !== "string" || password.length < 12) {
            return res.status(400).json({ message: "A valid email, six-digit code, and password of at least 12 characters are required" });
        }

        const user = await User.findOne({ email });
        const otp = await Otp.findOne({ email });
        if (!user || !otp || !otp.expiresAt || otp.expiresAt <= new Date()) {
            if (otp) await Otp.deleteMany({ email });
            return res.status(401).json({ message: "Invalid or expired verification code" });
        }

        if (otp.attempts >= 5) {
            await Otp.deleteMany({ email });
            return res.status(429).json({ message: "Too many attempts. Request a new code." });
        }

        const isValid = await bcrypt.compare(otpCode, otp.otpHash);
        if (!isValid) {
            otp.attempts += 1;
            if (otp.attempts >= 5) await Otp.deleteMany({ email });
            else await otp.save();
            return res.status(401).json({ message: "Invalid or expired verification code" });
        }

        user.password = await bcrypt.hash(password, 12);
        await user.save();
        await Otp.deleteMany({ email });
        return res.json({ message: "Password updated successfully" });
    } catch (error) {
        console.error("Password reset failed:", error.message);
        return res.status(500).json({ message: "Unable to update password" });
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

    const email = String(req.params.email || "").trim().toLowerCase();
    const allowedFields = ["firstName", "lastName", "email", "role", "isBlocked", "isEmailVerified", "image", "profileImage"];
    const updates = {};
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (req.body.password !== undefined) {
        if (typeof req.body.password !== "string" || req.body.password.length < 12) {
            return res.status(400).json({ message: "Password must be at least 12 characters long" });
        }
        updates.password = await bcrypt.hash(req.body.password, 12);
    }

    User.updateOne({ email }, { $set: updates }, { runValidators: true }).then((result) => {
        if (result.matchedCount === 0) return res.status(404).json({ message: "User Not Found" });
        return res.json({ message: "User updated successfully" });
    }).catch(() => {
        res.status(500).json({ message: "Error updating user" });
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