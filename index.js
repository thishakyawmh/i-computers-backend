import express from "express"
import mongoose from "mongoose"
import userRouter from "./routes/userRouter.js"
import jwt from "jsonwebtoken"
import productRouter from "./routes/productRouter.js"
import cors from 'cors';
import dotenv from "dotenv"


dotenv.config()
const mongoURL = process.env.MONGO_URL

mongoose.connect(mongoURL).then(
    ()=>{
        console.log("Connected to MongoDB Cluster")
    }
)

const app = express()
app.use(cors());



app.use(express.json())

app.use((req, res, next) =>{

     const authorizationHeader = req.header("Authorization")
     if (authorizationHeader != null){
            const token = authorizationHeader.replace("Bearer ","")

            // console.log(token)

            jwt.verify(token, JWT_SECRET,
                (error, content) =>{
                    
                    if (content == null){
                        console.log("Invalid Token")
                        res.json(
                            {message: "Invalid Token"
                        })

                    }else{
                        console.log(content)
                        req.user = content
                        next()
                    }
                }
            )
       }else{
          next()
       }
    }
   )

app.use("/api/users",userRouter)

app.use("/api/products", productRouter)


app.listen(3000, 
    ()=>{
        console.log("Server is running on port 3000")
    })

