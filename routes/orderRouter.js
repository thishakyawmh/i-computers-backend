import express from "express";
import { createOrder, getOrders, updateOrder } from "../controllers/orderController.js";

const OrderRouter = express.Router();

OrderRouter.post("/", createOrder);
OrderRouter.get("/", getOrders);
OrderRouter.put("/:orderID", updateOrder);

export default OrderRouter;