import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ECLearnix Dashboard",
  description: "Your learning dashboard"
};

export default function HoneypotLayout({ children }: { children: React.ReactNode }) {
  // Intentionally uses the same visual shell as the real app so the attacker
  // cannot visually distinguish this from a real session.
  return <>{children}</>;
}
