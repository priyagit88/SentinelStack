import { ProfileDashboard } from "@/components/profile-dashboard";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!session.user.emailVerified) {
    redirect(`/verify-request?email=${encodeURIComponent(session.user.email)}`);
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <ProfileDashboard />
    </main>
  );
}
