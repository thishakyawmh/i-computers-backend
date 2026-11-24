import { isAdmin } from "./userController.js";
import Review from "../models/Review.js";
import Product from "../models/Product.js";

export async function addReview(req, res) {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const productId = typeof req.body.productId === "string" ? req.body.productId.trim() : "";
        const rating = Number(req.body.rating);
        const comment = typeof req.body.comment === "string" ? req.body.comment.trim() : "";

        if (!productId || !Number.isInteger(rating) || rating < 1 || rating > 5 || !comment || comment.length > 2000) {
            return res.status(400).json({ message: "A valid product, 1-5 rating, and comment under 2000 characters are required" });
        }

        const product = await Product.findOne({ productID: productId }).select("productID name");
        if (!product) return res.status(404).json({ message: "Product not found" });

        const newReview = new Review({
            productId: product.productID,
            productName: product.name,
            rating,
            comment,
            username: `${req.user.firstName} ${req.user.lastName}`.trim(),
            email: req.user.email
        });

        await newReview.save();
        return res.status(201).json({ message: "Review added successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Error saving review", error: error.message });
    }
}

export async function getProductReviews(req, res) {
    try {
        const reviews = await Review.find({ productId: req.params.productId }).sort({ date: -1 });
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: "Error fetching reviews", error: error.message });
    }
}

export async function getAllReviews(req, res) {
    if (!isAdmin(req)) {
        return res.status(403).json({ message: "Forbidden" });
    }

    try {
        const reviews = await Review.find().sort({ date: -1 });
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: "Error fetching all reviews", error: error.message });
    }
}

export async function deleteReview(req, res) {
    if (!isAdmin(req)) {
        return res.status(403).json({ message: "Forbidden" });
    }

    try {
        await Review.findByIdAndDelete(req.params.id);
        res.json({ message: "Review deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting review", error: error.message });
    }
}
