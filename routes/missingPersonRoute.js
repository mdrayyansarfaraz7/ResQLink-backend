import express from "express";
import { createMissingPersonReport,findPotentialUnidentifiedMatches} from "../controllers/missingPersonControllers.js";
import upload from "../utils/upload.js"; 

const router = express.Router();


router.post("/", upload.single("photo"), createMissingPersonReport);
router.get("/:id/match", findPotentialUnidentifiedMatches);

export default router;