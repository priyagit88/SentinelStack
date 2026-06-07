import mongoose, { Schema, type Model } from "mongoose";

export type SentinelUser = {
  _id: mongoose.Types.ObjectId;
  id?: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string | null;
  isFlagged: boolean;
  riskScore: number;
  isBlocked: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

const UserSchema = new Schema<SentinelUser>(
  {
    id: { type: String, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String, default: null },
    isFlagged: { type: Boolean, default: false },
    riskScore: { type: Number, default: 0 },
    isBlocked: { type: Boolean, default: false }
  },
  {
    collection: "user",
    timestamps: true,
    strict: false
  }
);

export const User =
  (mongoose.models.User as Model<SentinelUser>) ||
  mongoose.model<SentinelUser>("User", UserSchema);
