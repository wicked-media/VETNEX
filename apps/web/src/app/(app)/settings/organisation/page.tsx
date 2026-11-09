import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@vetnex/ui";
import { apiFetch } from "@/lib/api";
import { can } from "@/lib/navigation";
import { getSession } from "@/lib/session";
import type { OrganisationDetail } from "@/lib/types";
import { OrganisationForm } from "./organisation-form";

export const metadata: Metadata = { title: "Organisation settings" };
export const dynamic = "force-dynamic";

export default async function OrganisationSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.permissions, "organisation:read")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No access</CardTitle>
        </CardHeader>
        <CardContent className="text-[13px] text-muted-foreground">
          Your role does not include access to organisation settings.
        </CardContent>
      </Card>
    );
  }

  const organisation = await apiFetch<OrganisationDetail>("/organisation");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Organisation settings"
        description="Regional defaults apply to every clinic unless a clinic overrides them. Changes are audited."
      />
      <OrganisationForm
        organisation={organisation}
        canManage={can(session.permissions, "organisation:manage")}
      />
      <Card>
        <CardHeader>
          <CardTitle>Compliance posture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
          <p>
            Retention and GST values configure system behaviour. They are not a certification:
            veterinary record-keeping obligations vary by state and territory and must be confirmed
            with your own advisers.
          </p>
          <p>
            Controlled-drug registers, prescribing controls and clinical record signing are
            scheduled for the clinical milestone and are not implemented in this build.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
