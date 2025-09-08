import { UnidentifiedPerson } from "../models/unidentifiedPerson.js";

// Create unidentified person report
export const createUnidentifiedPersonReport = async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "Photo is required" });
    }

    const data = req.body;

    // Parse JSON strings if sent from frontend via FormData
    if (data.physicalDescription && typeof data.physicalDescription === "string") {
      try {
        data.physicalDescription = JSON.parse(data.physicalDescription);
      } catch (err) {
        return res.status(400).json({ message: "Invalid physicalDescription format, must be valid JSON" });
      }
    }

    if (data.recoveryDetails && typeof data.recoveryDetails === "string") {
      try {
        data.recoveryDetails = JSON.parse(data.recoveryDetails);
      } catch (err) {
        return res.status(400).json({ message: "Invalid recoveryDetails format, must be valid JSON" });
      }
    }

    if (data.storageDetails && typeof data.storageDetails === "string") {
      try {
        data.storageDetails = JSON.parse(data.storageDetails);
      } catch (err) {
        return res.status(400).json({ message: "Invalid storageDetails format, must be valid JSON" });
      }
    }

    if (data.belongings && typeof data.belongings === "string") {
      try {
        data.belongings = JSON.parse(data.belongings);
      } catch (err) {
        return res.status(400).json({ message: "Invalid belongings format, must be valid JSON array" });
      }
    }

    // Validate required fields
    const requiredFields = ["foundAtLocation", "foundDate", "condition"];
    const missingFields = requiredFields.filter((field) => !data[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "Missing required fields",
        missingFields,
      });
    }

    // Add photo path
    data.photo = req.file.path;

    // Save unidentified person report
    const newReport = new UnidentifiedPerson(data);
    await newReport.save();

    res.status(201).json({
      message: "Unidentified person report submitted successfully",
      reportId: newReport._id,
    });
  } catch (error) {
    console.error("Error creating unidentified person report:", error);
    res.status(500).json({ message: "Server error" });
  }
};
