import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@vetnex/ui";
import { apiFetch } from "@/lib/api";
import { can } from "@/lib/navigation";
import { getSession } from "@/lib/session";
import type { AuditPage } from "@/lib/types";
import { AuditTable } from "./audit-table";

export const metadata: Metadata = { title: "Audit trail" };
export const dynamic = "force-dynamic";

export default async function AuditPageRoute() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.permissions, "audit:read")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No access</CardTitle>
        </CardHeader>
        <CardContent className="text-[13px] text-muted-foreground">
          Your role does not include audit access. Ask an owner to review or grant it.
        </CardContent>
      </Card>
    );
  }

  const initial = await apiFetch<AuditPage>("/audit?limit=25");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Audit trail"
        description="An append-only record of security, record and configuration events. Entries cannot be edited or deleted."
      />
      <AuditTable initial={initial} timezone={session.organisation.timezone} />
    </div>
  );
}
