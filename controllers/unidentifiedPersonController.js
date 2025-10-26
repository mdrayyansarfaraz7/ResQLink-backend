import { UnidentifiedPerson } from "../models/unidentifiedPerson.js";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import os from "os";
import { Storage } from "@google-cloud/storage";
import dotenv from "dotenv";

dotenv.config(); 

// ✅ Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// ✅ Configure Google Cloud Storage
const storage = new Storage({
  keyFilename: "./config/gcp-service-account.json", // Local dev
  // Or use credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY) for prod
});

export const createUnidentifiedPersonReport = async (req, res) => {
  try {
    console.log("Incoming unidentified person report...");
    console.log("req.file:", req.file);
    console.log("req.body:", req.body);

    if (!req.file?.path) {
      return res.status(400).json({ message: "Photo is required" });
    }

    const data = { ...req.body };

    // Parse JSON fields
    const parseJSONField = (key) => {
      if (data[key] && typeof data[key] === "string") {
        try {
          data[key] = JSON.parse(data[key]);
        } catch {
          throw new Error(`Invalid ${key} format — must be valid JSON`);
        }
      }
    };

    ["physicalDescription", "recoveryDetails", "storageDetails", "belongings"].forEach(parseJSONField);

    // Validate required fields
    const requiredFields = ["foundAtLocation", "foundDate", "condition"];
    const missingFields = requiredFields.filter((f) => !data[f]);
    if (missingFields.length) {
      return res.status(400).json({ message: "Missing required fields", missingFields });
    }

    // Attach initial photo
    data.photo = req.file.path;

    // Call AI API
    let processedData;
    try {
      console.log("Calling process_victim AI API...");
      const aiResponse = await axios.post(
        "https://resqlink-ai-api-159683191915.asia-south2.run.app/process_victim",
        data
      );
      processedData = aiResponse.data;
    } catch (apiError) {
      console.error("Error calling AI API:", apiError.response?.data || apiError.message);
      return res.status(502).json({ message: "Failed to process image with AI service" });
    }

    // Proxy image if it's a temporary GCS URL
    let finalPhotoUrl = processedData.photo;

    if (finalPhotoUrl) {
      try {
        const tempFilePath = path.join(os.tmpdir(), `temp_${Date.now()}.jpg`);

        if (finalPhotoUrl.startsWith("https://storage.googleapis.com/")) {
          console.log("Detected signed HTTPS GCS URL — proxying...");
          const response = await axios.get(finalPhotoUrl, { responseType: "arraybuffer" });
          fs.writeFileSync(tempFilePath, response.data);
        } else if (finalPhotoUrl.startsWith("gs://")) {
          console.log("Detected gs:// URI — downloading via Google SDK...");
          const gsUri = finalPhotoUrl.replace("gs://", "");
          const [bucketName, ...filePathParts] = gsUri.split("/");
          const filePathInBucket = filePathParts.join("/");
          await storage.bucket(bucketName).file(filePathInBucket).download({ destination: tempFilePath });
        } else {
          console.log("No proxy needed — non-GCS URL");
        }

        // Upload to Cloudinary if we downloaded a file
        if (fs.existsSync(tempFilePath)) {
          const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
            folder: "unidentified_persons",
            resource_type: "image",
          });
          fs.unlinkSync(tempFilePath);
          finalPhotoUrl = uploadResult.secure_url;
          processedData.photo = finalPhotoUrl;
        }
      } catch (proxyError) {
        console.error("Error proxying image:", proxyError.message);
        return res.status(500).json({ message: "Failed to proxy GCS image" });
      }
    }

    // Save report
    const newReport = new UnidentifiedPerson(processedData);
    await newReport.save();
    console.log("Report saved with ID:", newReport._id);

    res.status(201).json({
      message: "Unidentified person report submitted successfully",
      reportId: newReport._id,
      photo: finalPhotoUrl,
    });
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({ message: "Server error" });
  }
};
