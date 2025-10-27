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

export const findPotentialUnidentifiedMatches = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Finding unidentified person matches for MissingPerson ID: ${id}`);

    // --------------------------------------------
    // 1️⃣ Fetch the MissingPerson record by ID
    // --------------------------------------------
    const data = await MissingPerson.findById(id).lean();
    if (!data) {
      console.warn(`❌ No missing person found for ID: ${id}`);
      return res.status(404).json({ message: "Missing person not found" });
    }
    console.log("✅ Missing person found:", data.fullName || data._id);

    // --------------------------------------------
    // 2️⃣ Extract time and location for query
    // --------------------------------------------
    const lastSeenDate = new Date(data.lastSeenDate);
    if (isNaN(lastSeenDate)) {
      console.error("❌ Invalid lastSeenDate format in record:", data.lastSeenDate);
      return res.status(400).json({ message: "Invalid lastSeenDate format" });
    }

    const month = lastSeenDate.getMonth() + 1; // months are 0-indexed
    const year = lastSeenDate.getFullYear();
    const location = data.lastSeenLocation;

    console.log(`📅 Filtering unidentified persons near "${location}" in ${month}/${year}`);

    // --------------------------------------------
    // 3️⃣ Find UnidentifiedPerson reports
    // --------------------------------------------
    const potentialMatches = await UnidentifiedPerson.find({
      foundAtLocation: { $regex: location, $options: "i" },
      foundDate: {
        $gte: new Date(year, month - 1, 1),
        $lte: new Date(year, month, 0, 23, 59, 59),
      },
    }).lean();

    console.log(`✅ Found ${potentialMatches.length} potential unidentified reports`);

    // --------------------------------------------
    // 4️⃣ Send to AI API for similarity analysis
    // --------------------------------------------
    let aiMatches = [];
    try {
      console.log("🤖 Sending data to AI find_matches API...");
      const aiResponse = await axios.post(
        "https://resqlink-ai-api-159683191915.asia-south2.run.app/find_matches",
        {
          searcher_profile: data, // The missing person record
          candidate_profiles: potentialMatches, // The possible matches
        }
      );
      aiMatches = aiResponse.data;
      console.log("✅ AI find_matches response received:", aiMatches);
    } catch (apiError) {
      console.error("❌ Error calling AI find_matches API:", apiError.response?.data || apiError.message);
    }

    // --------------------------------------------
    // 5️⃣ Respond with data
    // --------------------------------------------
    res.status(200).json({
      message: "Potential matches found successfully",
      missingPerson: data,
      potentialMatchesCount: potentialMatches.length,
      aiMatches,
    });
  } catch (error) {
    console.error("💥 Server error in findPotentialUnidentifiedMatches:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

