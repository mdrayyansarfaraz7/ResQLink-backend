import express from "express";
import upload from "../utils/upload.js";
import {
  createUnidentifiedPersonReport,
} from "../controllers/unidentifiedPersonController.js";

const router = express.Router();

// POST - create unidentified person report
router.post("/", upload.single("photo"), createUnidentifiedPersonReport);

export default router;

