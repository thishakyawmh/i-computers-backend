import express from "express";
import { createUser, loginUser, getUser, googleLogin, sendOTP, validateOTAndUpdatePassword, getAllUsers, updateUserByEmail, deleteUserByEmail } from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.post("/", createUser)
userRouter.post("/login", loginUser)
userRouter.get("/", getUser)
userRouter.post("/google-login", googleLogin)
userRouter.get("/send-otp/:email", sendOTP)
userRouter.post("/validate-otp", validateOTAndUpdatePassword)
userRouter.get("/all", getAllUsers)
userRouter.put("/:email", updateUserByEmail)
userRouter.delete("/:email", deleteUserByEmail)

export default userRouter;              