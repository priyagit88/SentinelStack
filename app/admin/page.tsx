import { AdminCommandCenter } from "@/components/admin-command-center";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim());
  if (adminEmails.length > 0 && !adminEmails.includes(session.user.email)) {
    return (
      <main className="mx-auto flex max-w-7xl flex-col items-center justify-center px-5 py-24">
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-8 text-center text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
          <svg className="mx-auto mb-4 h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-2xl font-bold tracking-tight text-white">Access Denied</h1>
          <p className="mt-3 text-sm text-red-200/80">You do not have the required permissions to view the admin dashboard.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <AdminCommandCenter />
    </main>
  );
}
