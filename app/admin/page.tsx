import { AdminCommandCenter } from "@/components/admin-command-center";
import { auth } from "@/lib/auth";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";

export const runtime = "nodejs";

export default async function AdminPage() {
  // Wallet-based admin check (primary gate). The cookie is HMAC-verified, so it
  // cannot be forged — it's only issued by /api/admin/verify-wallet after a
  // signature + on-chain ADMIN_ROLE check.
  const cookieStore = await cookies();
  const adminSession = verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  // Fallback: ADMIN_EMAILS over the authenticated better-auth session.
  const session = await auth.api.getSession({ headers: await headers() });
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim());

  const hasWalletAccess = !!adminSession;
  const hasSessionAccess = !!(session && (adminEmails.length === 0 || adminEmails.includes(session.user.email)));

  if (!hasWalletAccess && !hasSessionAccess) {
    redirect("/admin/connect");
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <AdminCommandCenter />
    </main>
  );
}
