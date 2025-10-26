import { MissingPerson } from "../models/missingPerson.js";
import { UnidentifiedPerson } from "../models/unidentifiedPerson.js";
import axios from "axios";

export const createMissingPersonReport = async (req, res) => {
  try {
    if (!req.file?.path) {
      return res.status(400).json({ message: "Photo is required" });
    }

    const data = { ...req.body };

    // Parse JSON fields safely
    if (data.contactInfo && typeof data.contactInfo === "string") {
      try {
        data.contactInfo = JSON.parse(data.contactInfo);
      } catch {
        return res.status(400).json({ message: "Invalid contactInfo format, must be valid JSON" });
      }
    }

    if (data.physicalDescription && typeof data.physicalDescription === "string") {
      try {
        data.physicalDescription = JSON.parse(data.physicalDescription);
      } catch {
        return res.status(400).json({ message: "Invalid physicalDescription format, must be valid JSON" });
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
        return !data.contactInfo || !data.contactInfo.name || !data.contactInfo.phone;
      }
      return !data[field];
    });

    if (missingFields.length > 0) {
      return res.status(400).json({ message: "Missing required fields", missingFields });
    }

    // Add photo path
    data.photo = req.file.path;

    // Save new missing person report
    const newReport = new MissingPerson(data);
    await newReport.save();

    // ------------------------------
    // Aggregate & filter potential matches
    // ------------------------------
    const lastSeenDate = new Date(data.lastSeenDate);
    const month = lastSeenDate.getMonth() + 1; // Months are 0-indexed
    const year = lastSeenDate.getFullYear();

    // Example filter: same location & same month/year
    const potentialMatches = await UnidentifiedPerson.find({
      foundAtLocation: data.lastSeenLocation,
      foundDate: {
        $gte: new Date(year, month - 1, 1),
        $lte: new Date(year, month, 0, 23, 59, 59),
      },
    }).lean();

    // ------------------------------
    // Call AI API with missing person + potential matches
    // ------------------------------
    let aiMatches = [];
    try {
      const aiResponse = await axios.post(
        "https://resqlink-ai-api-159683191915.asia-south2.run.app/find_matches",
        {
          searcher_profile: newReport,
          candidate_profiles: potentialMatches,
        }
      );
      aiMatches = aiResponse.data;
      console.log("AI find_matches response:", aiMatches);
    } catch (apiError) {
      console.error("Error calling AI find_matches API:", apiError.response?.data || apiError.message);
    }

    // ------------------------------
    // Respond
    // ------------------------------
    res.status(201).json({
      message: "Missing person report submitted successfully",
      report: newReport,
      potentialMatches: aiMatches,
    });
  } catch (error) {
    console.error("Error creating missing person report:", error);
    res.status(500).json({ message: "Server error" });
  }
};
