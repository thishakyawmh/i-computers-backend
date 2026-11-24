import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 254
        },
        firstName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },
        password: {
            type: String,
            required: true,
            minlength: 60,
            select: false
        },
        role: {
            type: String,
            default: "customer",
            enum: ["customer", "admin"]
        },
        isBlocked: {
            type: Boolean,
            default: false
        },
        isEmailVerified: {
            type: Boolean,
            default: false
        },
        image: {
            type: String,
            default: null
        },
        profileImage: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
