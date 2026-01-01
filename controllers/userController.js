import { json } from 'express';
import User from '../models/User.js';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

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
            const payload = {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
                image: user.image
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
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Error fetching user", error: error.message });
    }
}

export async function googleLogin(req, res) {
    try {
        const response = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: {
                Authorization: `Bearer ${req.body.token}`
            }
        });
        const data = response.data;

        let user = await User.findOne({ email: data.email });

        if (user == null) {
            user = new User({
                email: data.email,
                firstName: data.given_name,
                lastName: data.family_name,
                password: "",
                role: "customer",
                isEmailVerified: true,
                image: data.picture
            });
            await user.save();
        } else {
            user.image = data.picture;
            await user.save();
        }

        const payload = {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            image: user.image
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: "150h"
        });

        res.json({
            message: "Login successful",
            token: token,
            role: user.role
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Google login failed", error: error.message });
    }
}
