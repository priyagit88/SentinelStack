import { NextResponse, type NextRequest } from "next/server";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    rememberMe?: boolean;
  };

  try {
    return await auth.api.signInEmail({
      body: {
        email: body.email ?? "",
        password: body.password ?? "",
        rememberMe: body.rememberMe ?? true
      },
      headers: request.headers,
      asResponse: true
    });
  } catch (error) {
    const message = error instanceof APIError ? error.message : "Unable to sign in.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
