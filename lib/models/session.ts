import mongoose, { Schema, type Model } from "mongoose";

export type GeoLocation = {
  lat?: number;
  lon?: number;
  city?: string;
  country?: string;
};

export type SentinelSession = {
  _id: mongoose.Types.ObjectId;
  id?: string;
  token: string;
  userId: string | mongoose.Types.ObjectId;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  location?: GeoLocation;
  createdAt?: Date;
  updatedAt?: Date;
};

const LocationSchema = new Schema<GeoLocation>(
  {
    lat: Number,
    lon: Number,
    city: String,
    country: String
  },
  { _id: false }
);

const SessionSchema = new Schema<SentinelSession>(
  {
    id: { type: String, index: true },
    token: { type: String, required: true, index: true },
    userId: { type: Schema.Types.Mixed, required: true, index: true },
    expiresAt: { type: Date, required: true },
    ipAddress: String,
    userAgent: String,
    location: { type: LocationSchema, default: null }
  },
  {
    collection: "session",
    timestamps: true,
    strict: false
  }
);

export const Session =
  (mongoose.models.Session as Model<SentinelSession>) ||
  mongoose.model<SentinelSession>("Session", SessionSchema);
