import express from "express";
import mongoose from "mongoose";
import userRouter from "./routes/userRouter.js";
import jwt from "jsonwebtoken";
import productRouter from "./routes/productRouter.js";
import cors from "cors";
import dotenv from "dotenv";
import OrderRouter from "./routes/orderRouter.js";
import reviewRouter from "./routes/reviewRouter.js";

dotenv.config();

const requiredEnvironment = ["MONGO_URL", "JWT_SECRET"];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);

if (missingEnvironment.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvironment.join(", ")}`);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    next();
});
app.use(express.json({ limit: "1mb" }));

// Public routes may omit Authorization. If a token is supplied, it must be valid.
app.use((req, res, next) => {
    const authorizationHeader = req.get("Authorization");

    if (!authorizationHeader) {
        return next();
    }

    const match = authorizationHeader.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
        return res.status(401).json({ message: "Invalid authorization header" });
    }

    jwt.verify(match[1], process.env.JWT_SECRET, (error, claims) => {
        if (error || !claims || typeof claims.email !== "string") {
            return res.status(401).json({ message: "Invalid or expired token" });
        }

        req.user = claims;
        return next();
    });
});

app.use("/api/users", userRouter);
app.use("/api/products", productRouter);
app.use("/api/orders", OrderRouter);
app.use("/api/reviews", reviewRouter);

async function startServer() {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log("Connected to MongoDB");

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
}

startServer();
