import { UnidentifiedPerson } from "../models/unidentifiedPerson.js";
import { MissingPerson } from "../models/missingPerson.js";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import os from "os";
import { Storage } from "@google-cloud/storage";
import dotenv from "dotenv";
import Fast2SMS from "fast-two-sms";

dotenv.config();

// ✅ Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// ✅ Google Cloud Storage config
const storage = new Storage({
  keyFilename: "./config/gcp-service-account.json",
});

export const createUnidentifiedPersonReport = async (req, res) => {
  try {
    console.log("🟣 [START] Incoming unidentified person report...");
    console.log("➡️ File received:", req.file?.path || "❌ No file");
    console.log("➡️ Body received:", req.body);

    if (!req.file?.path) {
      console.log("❌ No photo provided in request");
      return res.status(400).json({ message: "Photo is required" });
    }

    const data = { ...req.body };

    // Parse JSON fields safely
    const parseJSONField = (key) => {
      if (data[key] && typeof data[key] === "string") {
        try {
          console.log(`📦 Parsing JSON field: ${key}`);
          data[key] = JSON.parse(data[key]);
        } catch {
          console.error(`❌ Failed to parse ${key}: Invalid JSON`);
          throw new Error(`Invalid ${key} format — must be valid JSON`);
        }
      }
    };
    ["physicalDescription", "recoveryDetails", "storageDetails", "belongings"].forEach(parseJSONField);

    // Validate required fields
    const requiredFields = ["foundAtLocation", "foundDate", "condition"];
    const missingFields = requiredFields.filter((f) => !data[f]);
    if (missingFields.length) {
      console.log("❌ Missing required fields:", missingFields);
      return res.status(400).json({ message: "Missing required fields", missingFields });
    }

    data.photo = req.file.path;

    // 🧠 Call AI API
    console.log("🤖 Calling AI API to process unidentified person data...");
    let processedData;
    try {
      const aiResponse = await axios.post(
        "https://resqlink-ai-api-159683191915.asia-south2.run.app/process_victim",
        data
      );
      processedData = aiResponse.data;
      console.log("✅ AI API response received successfully");
    } catch (apiError) {
      console.error("❌ Error calling AI API:", apiError.response?.data || apiError.message);
      return res.status(502).json({ message: "Failed to process image with AI service" });
    }

    // 🧩 Handle photo URL from AI output
    let finalPhotoUrl = processedData.photo;
    console.log("🖼️ AI returned photo URL:", finalPhotoUrl);

    if (finalPhotoUrl) {
      try {
        const tempFilePath = path.join(os.tmpdir(), `temp_${Date.now()}.jpg`);
        console.log("📁 Temporary file path:", tempFilePath);

        if (finalPhotoUrl.startsWith("https://storage.googleapis.com/")) {
          console.log("☁️ Detected GCS HTTPS URL, downloading image...");
          const response = await axios.get(finalPhotoUrl, { responseType: "arraybuffer" });
          fs.writeFileSync(tempFilePath, response.data);
        } else if (finalPhotoUrl.startsWith("gs://")) {
          console.log("☁️ Detected gs:// URI, downloading via Google SDK...");
          const gsUri = finalPhotoUrl.replace("gs://", "");
          const [bucketName, ...filePathParts] = gsUri.split("/");
          const filePathInBucket = filePathParts.join("/");
          await storage.bucket(bucketName).file(filePathInBucket).download({ destination: tempFilePath });
        }

        if (fs.existsSync(tempFilePath)) {
          console.log("📤 Uploading downloaded image to Cloudinary...");
          const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
            folder: "unidentified_persons",
            resource_type: "image",
          });
          fs.unlinkSync(tempFilePath);
          finalPhotoUrl = uploadResult.secure_url;
          processedData.photo = finalPhotoUrl;
          console.log("✅ Cloudinary upload complete. Final photo URL:", finalPhotoUrl);
        }
      } catch (proxyError) {
        console.error("❌ Error proxying image:", proxyError.message);
      }
    }

    // 🧾 Save unidentified person report
    console.log("💾 Saving unidentified person report to MongoDB...");
    const newReport = new UnidentifiedPerson(processedData);
    await newReport.save();
    console.log("✅ Report saved successfully with ID:", newReport._id);

    // 🔍 MATCHING LOGIC
    console.log("🔍 Finding possible matches in MissingPerson collection...");
    const { foundAtLocation, physicalDescription, belongings, gender } = processedData;
   
    const age = physicalDescription?.age;

    const query = { gender };
    if (age) query.age = { $gte: age - 5, $lte: age + 5 };
    if (foundAtLocation) query.lastSeenLocation = { $regex: foundAtLocation, $options: "i" };

    console.log("📊 Querying MissingPerson with:", query);
    const possibleMatches = await MissingPerson.find(query);
    console.log(`✅ Found ${possibleMatches.length} possible matches.`);

    // 📩 SMS Notification
    if (possibleMatches.length > 0) {
      console.log("📱 Sending SMS notifications via Fast2SMS...");
      for (const person of possibleMatches) {
        const phone = person?.contactInfo?.phone;
        if (phone) {
          try {
            console.log(`📨 Sending alert SMS to ${phone}...`);
            await Fast2SMS.sendMessage({
              authorization: process.env.FAST2SMS_API_KEY,
              message: `ALERT: A new unidentified person matching your missing person report has been found near ${foundAtLocation}. View photo: ${finalPhotoUrl}`,
              numbers: [phone],
            });
            console.log(`✅ SMS successfully sent to ${phone}`);
          } catch (smsError) {
            console.error(`❌ Failed to send SMS to ${phone}:`, smsError.message);
          }
        } else {
          console.log("⚠️ No phone number found for a matched report");
        }
      }
    } else {
      console.log("ℹ️ No similar missing person reports found. No SMS sent.");
    }

    console.log("✅ [COMPLETE] Unidentified person report workflow finished.");
    res.status(201).json({
      message: "Unidentified person report submitted successfully",
      reportId: newReport._id,
      photo: finalPhotoUrl,
      matchedReports: possibleMatches.length,
    });
  } catch (error) {
    console.error("🔥 [ERROR] Error creating unidentified person report:", error);
    res.status(500).json({ message: "Server error" });
  }
};
