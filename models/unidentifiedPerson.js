import mongoose from "mongoose";

const unidentifiedPersonSchema = new mongoose.Schema({
  foundAtLocation: {
    type: String,
    required: true,
  },
  foundDate: {
    type: Date,
    required: true,
  },
  condition: {
    type: String,
    enum: ["alive_injured", "alive_unconscious", "deceased", "other"],
    required: true,
  },
  estimatedAge: {
    type: Number,
  },
  gender: {
    type: String,
    enum: ["Male", "Female", "Other", "Unknown"],
    default: "Unknown",
  },
  physicalDescription: {
    height: { type: Number }, // cm
    weight: { type: Number }, // kg
    eyeColor: { type: String },
    hairColor: { type: String },
    distinguishingMarks: { type: String }, // tattoos, scars, birthmarks
  },
  clothingDescription: {
    type: String,
  },
  belongings: {
    type: [String], // wallet, jewelry, bag etc.
  },
  photo: {
    type: String, 
    required: true,
  },
  recoveryDetails: {
    recoveredBy: { type: String }, // rescue team/org
    contact: { type: String }, // rescue contact no.
    referenceId: { type: String }, // official case/ref number
  },
  storageDetails: {
    hospital: { type: String }, 
    morgue: { type: String },   
    wardOrUnit: { type: String },
  },
  status: {
    type: String,
    enum: ["unidentified", "matched", "claimed", "closed"],
    default: "unidentified",
  },
  matchedWith: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MissingPerson", 
  },
  additionalNotes: {
    type: String,
  },
}, { timestamps: true });

export const UnidentifiedPerson = mongoose.model("UnidentifiedPerson", unidentifiedPersonSchema);
