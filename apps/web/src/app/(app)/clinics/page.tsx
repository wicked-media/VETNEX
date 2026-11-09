import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@vetnex/ui";
import { apiFetch } from "@/lib/api";
import { can } from "@/lib/navigation";
import { getSession } from "@/lib/session";
import type { ClinicRecord } from "@/lib/types";
import { ClinicManager } from "./clinic-manager";

export const metadata: Metadata = { title: "Clinics" };
export const dynamic = "force-dynamic";

export default async function ClinicsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.permissions, "clinic:read")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No access</CardTitle>
        </CardHeader>
        <CardContent className="text-[13px] text-muted-foreground">
          Your role does not include access to clinic locations.
        </CardContent>
      </Card>
    );
  }

  const clinics = await apiFetch<ClinicRecord[]>("/clinics");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Practice"
        title="Clinics"
        description="Locations that own schedules, stock and clinical records. Each clinic keeps its own departments and contact details."
      />
      <ClinicManager
        clinics={clinics}
        canManage={can(session.permissions, "clinic:manage")}
        organisationTimezone={session.organisation.timezone}
      />
    </div>
  );
}
