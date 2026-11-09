import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { visibleNavItems } from "@/lib/navigation";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <AppShell session={session} items={visibleNavItems(session.permissions)}>
      {children}
    </AppShell>
  );
}
