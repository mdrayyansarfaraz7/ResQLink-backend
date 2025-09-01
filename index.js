import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
dotenv.config();


connectDB();

const app=express();

app.use(express.json());

app.listen(8080,()=>{
    console.log('Listining to port 8080.')
});