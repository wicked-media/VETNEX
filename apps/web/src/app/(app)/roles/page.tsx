import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@vetnex/ui";
import { apiFetch } from "@/lib/api";
import { can } from "@/lib/navigation";
import { getSession } from "@/lib/session";
import type { RoleRecord } from "@/lib/types";
import { RoleManager } from "./role-manager";

export const metadata: Metadata = { title: "Roles" };
export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session.permissions, "role:read")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No access</CardTitle>
        </CardHeader>
        <CardContent className="text-[13px] text-muted-foreground">
          Your role does not include access to roles and permissions.
        </CardContent>
      </Card>
    );
  }

  const roles = await apiFetch<RoleRecord[]>("/roles");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Roles and permissions"
        description="Roles decide what a person can see and do. Permissions for modules that have not shipped yet are shown as unavailable rather than granted."
      />
      <RoleManager roles={roles} canManage={can(session.permissions, "role:manage")} />
    </div>
  );
}
