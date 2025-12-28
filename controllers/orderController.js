import Order from "../models/Order.js";

export async function createOrder(req, res) {
    if (!req.user) {
        res.status(401).json({
            message: "Unauthorized"
        });
        return;
    }

    try {
        const latestOrder = await Order.findOne().sort({ date: -1 });

        let orderID = "ORD000001"

        if (latestOrder != null) {
            let latestOrderID = latestOrder.orderID;
            let latestOrderNumberString = latestOrderID.replace("ORD", "");
            let latestOrderNumber = parseInt(latestOrderNumberString);

            let newOrderNumber = latestOrderNumber + 1;
            orderID = "ORD" + newOrderNumber.toString().padStart(6, "0");
        }

        const items = []
        let total = 0

        for (let i = 0; i < req.body.items.length; i++) {
            const product = await Product.findOne({ productID: req.body.items[i].productID })
            if (product == null) {
                res.status(404).json({
                    message: "Product with ID " + req.body.items[i].productID + " not found"
                })
            }

            items.push({
                productID: product.productID,
                name: product.name,
                price: product.price,
                quantity: req.body.items[i].quantity,
                image: product.image[0]
            })

            total = total + product.price * req.body.items[i].quantity

            // await Product.updateOne(
            //     {productID: req.body.items[i].productID},
            //     {stock: product.stock - req.body.items[i].quantity})
        }

        let name = req.body.name

        if (req.body.name == null) {
            name = req.user.firstName + " " + req.user.lastName
        }

        const newOrder = new Order({
            orderID: orderID,
            email: req.user.email,
            name: name,
            address: req.body.address,
            total: total,
            items: items,
        })

        await newOrder.save()

        res.json({
            message: "Order placed successfully"
        })



    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Error placing order",
            error: error.message
        });
    }
}