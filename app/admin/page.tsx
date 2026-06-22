import { AdminCommandCenter } from "@/components/admin-command-center";
import { auth } from "@/lib/auth";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default async function AdminPage() {
  // Wallet-based admin check (primary gate)
  const cookieStore = await cookies();
  const adminWallet = cookieStore.get("admin_wallet")?.value;

  // Fallback to session-based auth for backwards compatibility
  const session = await auth.api.getSession({ headers: await headers() });
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim());

  const hasWalletAccess = !!adminWallet;
  const hasSessionAccess = !!(session && (adminEmails.length === 0 || adminEmails.includes(session.user.email)));

  if (!hasWalletAccess && !hasSessionAccess) {
    redirect("/admin/connect");
  }

  if (!hasWalletAccess && hasSessionAccess) {
    // Legacy session-based admin — allow but show wallet notice
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <AdminCommandCenter />
    </main>
  );
}
