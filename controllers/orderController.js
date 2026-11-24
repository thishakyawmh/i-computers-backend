import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

export async function createOrder(req, res) {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const rawItems = req.body.items;
    const address = typeof req.body.address === "string" ? req.body.address.trim() : "";
    const notes = typeof req.body.notes === "string" ? req.body.notes.trim() : "";

    if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 50) {
        return res.status(400).json({ message: "An order must contain between 1 and 50 items" });
    }
    if (!address || address.length > 1000 || notes.length > 1000) {
        return res.status(400).json({ message: "A valid delivery address is required and notes must be under 1000 characters" });
    }

    const quantities = new Map();
    for (const item of rawItems) {
        if (
            !item ||
            typeof item.productID !== "string" ||
            !item.productID.trim() ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity <= 0 ||
            item.quantity > 100
        ) {
            return res.status(400).json({ message: "Each item must have a valid product ID and quantity between 1 and 100" });
        }
        const productID = item.productID.trim();
        quantities.set(productID, (quantities.get(productID) || 0) + item.quantity);
    }

    const session = await mongoose.startSession();
    const orderID = `ORD-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;

    try {
        let savedOrder;
        await session.withTransaction(async () => {
            const items = [];
            let total = 0;

            for (const [productID, quantity] of quantities.entries()) {
                const productExists = await Product.findOne({ productID }).session(session).select("productID");
                if (!productExists) {
                    const error = new Error("PRODUCT_NOT_FOUND");
                    error.statusCode = 404;
                    throw error;
                }

                const product = await Product.findOneAndUpdate(
                    { productID, isAvailable: true, stock: { $gte: quantity } },
                    { $inc: { stock: -quantity } },
                    { new: true, session }
                );

                if (!product) {
                    const error = new Error("INSUFFICIENT_STOCK");
                    error.statusCode = 409;
                    throw error;
                }

                items.push({
                    productID: product.productID,
                    name: product.name,
                    price: product.price,
                    quantity,
                    image: product.images?.[0] || ""
                });
                total += product.price * quantity;
            }

            const payload = {
                orderID,
                email: req.user.email,
                name: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || req.user.email,
                address,
                total: Number(total.toFixed(2)),
                items,
                notes
            };
            const created = await Order.create([payload], { session });
            savedOrder = created[0];
        });

        return res.status(201).json({
            message: "Order placed successfully",
            orderID: savedOrder.orderID
        });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ message: "One or more products could not be found" });
        }
        if (error.statusCode === 409) {
            return res.status(409).json({ message: "Insufficient stock for one or more products" });
        }
        console.error("Order creation failed:", error.message);
        return res.status(500).json({ message: "Unable to place order" });
    } finally {
        await session.endSession();
    }
}

function isAdmin(req) {
    return req.user && req.user.role === "admin";
}

export async function getOrders(req, res) {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const orders = isAdmin(req)
            ? await Order.find().sort({ date: -1 })
            : await Order.find({ email: req.user.email }).sort({ date: -1 });
        return res.json(orders);
    } catch (error) {
        console.error("Order lookup failed:", error.message);
        return res.status(500).json({ message: "Unable to fetch orders" });
    }
}

export async function updateOrder(req, res) {
    if (!isAdmin(req)) {
        return res.status(403).json({ message: "Forbidden" });
    }

    const allowedStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
    const { status, notes } = req.body;
    if (!allowedStatuses.includes(status) || (notes !== undefined && (typeof notes !== "string" || notes.length > 1000))) {
        return res.status(400).json({ message: "Invalid order status or notes" });
    }

    const session = await mongoose.startSession();
    try {
        let updatedOrder = null;
        await session.withTransaction(async () => {
            const order = await Order.findOne({ orderID: req.params.orderID }).session(session);
            if (!order) return;
            if (order.status === "cancelled" && status !== "cancelled") {
                const error = new Error("CANCELLED_ORDER_CANNOT_BE_REOPENED");
                error.statusCode = 409;
                throw error;
            }

            if (status === "cancelled" && order.status !== "cancelled") {
                for (const item of order.items) {
                    await Product.updateOne(
                        { productID: item.productID },
                        { $inc: { stock: item.quantity } },
                        { session }
                    );
                }
            }

            order.status = status;
            if (notes !== undefined) order.notes = notes;
            await order.save({ session });
            updatedOrder = order;
        });

        if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
        return res.json({ message: "Order updated successfully", order: updatedOrder });
    } catch (error) {
        if (error.statusCode === 409) return res.status(409).json({ message: "A cancelled order cannot be reopened" });
        console.error("Order update failed:", error.message);
        return res.status(500).json({ message: "Unable to update order" });
    } finally {
        await session.endSession();
    }
}
