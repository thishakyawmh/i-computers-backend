import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";

import userRouter from "./routes/userRouter.js";
import productRouter from "./routes/productRouter.js";
import OrderRouter from "./routes/orderRouter.js";
import reviewRouter from "./routes/reviewRouter.js";

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const MONGO_URL = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = process.env.JWT_ISSUER || "i-computers-api";

if (!MONGO_URL) {
    throw new Error("MONGO_URL must be configured");
}
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters");
}

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true
}));

app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    next();
});

app.use(express.json({ limit: "1mb" }));

// Public routes may omit Authorization. If a token is supplied, it must be valid.
app.use((req, res, next) => {
    const authorizationHeader = req.get("Authorization");
    if (!authorizationHeader) return next();

    const [scheme, token, ...extra] = authorizationHeader.trim().split(/\s+/);
    if (scheme !== "Bearer" || !token || extra.length > 0) {
        return res.status(401).json({ message: "Invalid Authorization header" });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET, {
            algorithms: ["HS256"],
            issuer: JWT_ISSUER
        });
        return next();
    } catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
});

app.use("/api/users", userRouter);
app.use("/api/products", productRouter);
app.use("/api/orders", OrderRouter);
app.use("/api/reviews", reviewRouter);

app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

app.use((error, req, res, next) => {
    console.error("Unhandled API error:", error.message);
    if (res.headersSent) return next(error);
    return res.status(500).json({ message: "Internal server error" });
});

async function startServer() {
    try {
        await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 10000 });
        console.log("Connected to MongoDB");
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to connect to MongoDB:", error.message);
        process.exit(1);
    }
}

startServer();
