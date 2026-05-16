import mongoose from "mongoose";
import { MongoClient } from "mongodb";

export const mongoUri =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/sentinelstack";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

type MongoCache = {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
};

const globalForDb = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
  mongoClientCache?: MongoCache;
};

const mongooseCache =
  globalForDb.mongooseCache ?? (globalForDb.mongooseCache = { conn: null, promise: null });

const mongoClientCache =
  globalForDb.mongoClientCache ?? (globalForDb.mongoClientCache = { client: null, promise: null });

export async function connectMongoose() {
  if (mongooseCache.conn) return mongooseCache.conn;

  if (!mongooseCache.promise) {
    mongooseCache.promise = mongoose.connect(mongoUri, {
      bufferCommands: false
    });
  }

  mongooseCache.conn = await mongooseCache.promise;
  return mongooseCache.conn;
}

export async function getMongoClient() {
  if (mongoClientCache.client) return mongoClientCache.client;

  if (!mongoClientCache.promise) {
    mongoClientCache.promise = new MongoClient(mongoUri).connect();
  }

  mongoClientCache.client = await mongoClientCache.promise;
  return mongoClientCache.client;
}

export async function getMongoDb() {
  const client = await getMongoClient();
  return client.db();
}
