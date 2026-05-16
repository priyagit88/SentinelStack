import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectMongoose } from "@/lib/db";
import { headers } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = (await connectMongoose()).connection.db;
    if (!db) throw new Error("Database connection failed");

    const accounts = await db.collection("account").find({
      userId: session.user.id
    }).toArray();

    return NextResponse.json({
      accounts: accounts.map(acc => ({
        id: acc._id?.toString() || acc.id,
        providerId: acc.providerId,
        accountId: acc.accountId,
        createdAt: acc.createdAt
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch connected accounts" }, { status: 500 });
  }
}
