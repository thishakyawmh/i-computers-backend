import express from "express";
import { addReview, getProductReviews, getAllReviews, deleteReview } from "../controllers/reviewController.js";

const reviewRouter = express.Router();

reviewRouter.post("/", addReview);
reviewRouter.get("/product/:productId", getProductReviews);
reviewRouter.get("/", getAllReviews);
reviewRouter.delete("/:id", deleteReview);

export default reviewRouter;
