import mongoose from "mongoose";

const missingPersonSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  age: {
    type: Number,
    required: true,
  },
  gender: {
    type: String,
    enum: ["Male", "Female", "Other"],
    required: true,
  },
  physicalDescription: {
    height: { type: Number }, // in cm
    weight: { type: Number }, // in kg
    eyeColor: { type: String },
    hairColor: { type: String },
    distinguishingMarks: { type: String }, // tattoos, scars, birthmarks
  },
  lastSeenLocation: {
    type: String,
    required: true,
  },
  lastSeenDate: {
    type: Date,
    required: true,
  },
  clothingDescription: {
    type: String,
  },
  causeOfSeparation: {
    type: String,
    enum: [
      "natural_disaster",
      "accident",
      "conflict/violence",
      "lost_while_evacuating",
      "other",
    ],
    required: true,
  },
  photo: {
    type: String, 
    required: true,
  },
  contactInfo: {
    name: { type: String, required: true },
    relation: { type: String },
    phone: { type: String, required: true },
    email: { type: String },
    address: { type: String },
  },
  additionalNotes: {
    type: String,
  },
  status: {
    type: String,
    enum: ["missing", "matched", "found", "closed"],
    default: "missing",
  },
  matchedWith: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UnidentifiedPerson", 
  },
}, { timestamps: true });

export const MissingPerson = mongoose.model("MissingPerson", missingPersonSchema);
