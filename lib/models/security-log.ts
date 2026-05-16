import mongoose, { Schema, type Model } from "mongoose";

export const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Severity = (typeof severities)[number];

export type SecurityLogDocument = {
  userId?: mongoose.Types.ObjectId | null;
  type: string;
  severity: Severity;
  details: string;
  ip: string;
  timestamp: Date;
  aiAnalysis: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

const SecurityLogSchema = new Schema<SecurityLogDocument>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    type: { type: String, required: true, index: true },
    severity: { type: String, enum: severities, required: true, index: true },
    details: { type: String, required: true },
    ip: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
    aiAnalysis: { type: Object, default: null },
    metadata: { type: Object, default: {} }
  },
  { collection: "securityLog" }
);

export const SecurityLog =
  (mongoose.models.SecurityLog as Model<SecurityLogDocument>) ||
  mongoose.model<SecurityLogDocument>("SecurityLog", SecurityLogSchema);
