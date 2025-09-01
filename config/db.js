import mongoose from "mongoose";
import dotenv from 'dotenv';
dotenv.config();

const connectDB=async ()=>{
    try{
        await mongoose.connect(process.env.MONGO_DB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
          });
          console.log('MongoDB Connected...');
    } catch (error) {
        console.log('Error in Connecting DBs: ',error);
    }
}

export default connectDB;