import mongoose, { Schema, type Model } from "mongoose";

export type HoneyLogDocument = {
  sessionToken: string;          // The honeypot cookie value (links actions to one attacker session)
  userEmail: string;
  ipAddress: string;
  userAgent?: string;
  location?: {
    lat?: number;
    lon?: number;
    city?: string;
    country?: string;
  };
  action: string;                // e.g. "LOGIN", "VIEW_PROFILE", "CHANGE_PASSWORD_ATTEMPT", "POST_SPAM"
  payload?: Record<string, unknown>; // Whatever they submitted (sanitised)
  aiConfidenceScore?: number;    // AI score that triggered deception
  aiSummary?: string;
  timestamp: Date;
};

const HoneyLogSchema = new Schema<HoneyLogDocument>(
  {
    sessionToken: { type: String, required: true, index: true },
    userEmail:    { type: String, required: true, index: true },
    ipAddress:    { type: String, required: true },
    userAgent:    { type: String, default: null },
    location:     { type: Object, default: null },
    action:       { type: String, required: true, index: true },
    payload:      { type: Object, default: {} },
    aiConfidenceScore: { type: Number, default: null },
    aiSummary:    { type: String, default: null },
    timestamp:    { type: Date, default: Date.now, index: true }
  },
  { collection: "honeyLog" }
);

export const HoneyLog =
  (mongoose.models.HoneyLog as Model<HoneyLogDocument>) ||
  mongoose.model<HoneyLogDocument>("HoneyLog", HoneyLogSchema);
