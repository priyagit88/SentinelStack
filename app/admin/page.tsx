import { AdminCommandCenter } from "@/components/admin-command-center";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <AdminCommandCenter />
    </main>
  );
}
