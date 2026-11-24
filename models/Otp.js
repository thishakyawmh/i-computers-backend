import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    otpHash: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        expires: 0
    },
    attempts: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Otp = mongoose.model("Otp", otpSchema);

export default Otp;
