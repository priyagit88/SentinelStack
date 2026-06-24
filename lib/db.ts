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
  // readyState 1 = connected. If a previous connection dropped, fall through
  // and re-establish rather than returning a dead handle (bufferCommands:false
  // would otherwise make every query throw).
  if (mongooseCache.conn && mongooseCache.conn.connection.readyState === 1) {
    return mongooseCache.conn;
  }

  if (!mongooseCache.promise) {
    mongooseCache.promise = mongoose
      .connect(mongoUri, {
        bufferCommands: false,
        // Fail fast (8s) instead of the 30s default so a transient outage
        // surfaces quickly instead of hanging the request.
        serverSelectionTimeoutMS: 8000
      })
      .catch((err) => {
        // CRITICAL: never leave a rejected promise in the cache. Without this
        // reset, a single failed connect (e.g. a brief Atlas blip) poisons the
        // global cache and every subsequent DB call re-throws forever until the
        // process restarts — which manifests as empty-body 500s on every route
        // that touches the database.
        mongooseCache.promise = null;
        throw err;
      });
  }

  try {
    mongooseCache.conn = await mongooseCache.promise;
  } catch (err) {
    mongooseCache.conn = null;
    throw err;
  }
  return mongooseCache.conn;
}

export async function getMongoClient() {
  if (mongoClientCache.client) return mongoClientCache.client;

  if (!mongoClientCache.promise) {
    mongoClientCache.promise = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 8000
    })
      .connect()
      .catch((err) => {
        // Never cache a rejected promise (see connectMongoose for why).
        mongoClientCache.promise = null;
        throw err;
      });
  }

  try {
    mongoClientCache.client = await mongoClientCache.promise;
  } catch (err) {
    mongoClientCache.client = null;
    throw err;
  }
  return mongoClientCache.client;
}

export async function getMongoDb() {
  const client = await getMongoClient();
  return client.db();
}
