import express from "express";
import { createMissingPersonReport} from "../controllers/missingPersonControllers.js";
import upload from "../utils/upload.js"; 

const router = express.Router();


router.post("/", upload.single("photo"), createMissingPersonReport);
export default router;