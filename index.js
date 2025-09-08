import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import missingPersonRoutes from './routes/missingPersonRoute.js';
import unidentifiedPersonRoutes from "./routes/unidentifiedPersonRoute.js";

dotenv.config();
connectDB();

const app = express();

app.use(cors()); 
app.use(express.json());

// Routes
app.use('/api/missing', missingPersonRoutes);
app.use("/api/unidentified", unidentifiedPersonRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
