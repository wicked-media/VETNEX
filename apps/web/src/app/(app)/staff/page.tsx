import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@vetnex/ui";
import { apiFetch } from "@/lib/api";
import { can } from "@/lib/navigation";
import { getSession } from "@/lib/session";
import type { ClinicRecord, InvitationRecord, RoleRecord, StaffMember } from "@/lib/types";
import { StaffWorkspace } from "./staff-workspace";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.permissions, "staff:read")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No access</CardTitle>
        </CardHeader>
        <CardContent className="text-[13px] text-muted-foreground">
          Your role does not include access to the staff directory.
        </CardContent>
      </Card>
    );
  }

  const [members, invitations, roles, clinics] = await Promise.all([
    apiFetch<StaffMember[]>("/staff"),
    apiFetch<InvitationRecord[]>("/staff/invitations"),
    apiFetch<RoleRecord[]>("/roles"),
    apiFetch<ClinicRecord[]>("/clinics"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Practice"
        title="Team"
        description="Everyone who works in this practice, what they can do, and where they can do it."
      />
      <StaffWorkspace
        members={members}
        invitations={invitations}
        roles={roles}
        clinics={clinics}
        currentUserId={session.user.id}
        timezone={session.organisation.timezone}
        canInvite={can(session.permissions, "staff:invite")}
        canManage={can(session.permissions, "staff:manage")}
      />
    </div>
  );
}
