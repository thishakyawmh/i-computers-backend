import { isAdmin } from "./userController.js";
import Review from "../models/Review.js";

export async function addReview(req, res) {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const { productId, productName, rating, comment } = req.body;

        const newReview = new Review({
            productId,
            productName,
            rating,
            comment,
            username: `${req.user.firstName} ${req.user.lastName}`,
            email: req.user.email
        });

        await newReview.save();
        res.status(201).json({ message: "Review added successfully!" });
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
