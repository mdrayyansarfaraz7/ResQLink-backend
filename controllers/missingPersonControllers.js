import { MissingPerson } from "../models/missingPerson.js";

export const createMissingPersonReport = async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "Photo is required" });
    }

    const data = req.body;

    // Parse contactInfo if sent as JSON string
    if (data.contactInfo && typeof data.contactInfo === "string") {
      try {
        data.contactInfo = JSON.parse(data.contactInfo);
      } catch (err) {
        return res.status(400).json({
          message: "Invalid contactInfo format, must be valid JSON",
        });
      }
    }

    // Parse physicalDescription if sent as JSON string
    if (data.physicalDescription && typeof data.physicalDescription === "string") {
      try {
        data.physicalDescription = JSON.parse(data.physicalDescription);
      } catch (err) {
        return res.status(400).json({
          message: "Invalid physicalDescription format, must be valid JSON",
        });
      }
    }

    // Validate required fields
    const requiredFields = [
      "fullName",
      "age",
      "gender",
      "lastSeenLocation",
      "lastSeenDate",
      "causeOfSeparation",
      "contactInfo",
    ];

    const missingFields = requiredFields.filter((field) => {
      if (field === "contactInfo") {
        return (
          !data.contactInfo ||
          !data.contactInfo.name ||
          !data.contactInfo.phone
        );
      }
      return !data[field];
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "Missing required fields",
        missingFields,
      });
    }

    // Add photo path
    data.photo = req.file.path;
   
    // Save report
    const newReport = new MissingPerson(data);
    await newReport.save();

    res.status(201).json({
      message: "Missing person report submitted successfully",
      reportId: newReport._id,
    });
  } catch (error) {
    console.error("Error creating missing person report:", error);
    res.status(500).json({ message: "Server error" });
  }
};
