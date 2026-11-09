"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@vetnex/ui";
import { inviteStaffSchema, updateMembershipSchema } from "@vetnex/shared";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { useForm } from "@/lib/forms";
import { Dialog } from "@/components/dialog";
import { Icon } from "@/components/icons";
import type { ClinicRecord, InvitationRecord, RoleRecord, StaffMember } from "@/lib/types";

interface Props {
  members: StaffMember[];
  invitations: InvitationRecord[];
  roles: RoleRecord[];
  clinics: ClinicRecord[];
  currentUserId: string;
  timezone: string;
  canInvite: boolean;
  canManage: boolean;
}

export function StaffWorkspace({
  members,
  invitations,
  roles,
  clinics,
  currentUserId,
  timezone,
  canInvite,
  canManage,
}: Props) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const inviteForm = useForm(inviteStaffSchema, {
    email: "",
    roleId: roles.find((role) => role.systemKey === "veterinarian")?.id ?? roles[0]?.id ?? "",
    fullName: "",
    title: "",
    clinicIds: [],
  });

  const editForm = useForm(updateMembershipSchema, {
    roleId: "",
    status: "ACTIVE" as "ACTIVE" | "SUSPENDED",
    title: "",
    clinicIds: [] as string[],
  });

  function formatDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
      }).format(new Date(iso));
    } catch {
      return new Date(iso).toLocaleString("en-AU");
    }
  }

  function clinicNames(ids: string[]): string {
    if (ids.length === 0) return "All clinics";
    const names = clinics.filter((clinic) => ids.includes(clinic.id)).map((clinic) => clinic.name);
    return names.length > 0 ? names.join(", ") : "All clinics";
  }

  async function revokeInvitation(id: string) {
    setBusyId(id);
    setBanner(null);
    try {
      await apiRequest(`/staff/invitations/${id}/revoke`, { method: "POST" });
      setBanner("Invitation revoked.");
      router.refresh();
    } catch (error) {
      setBanner(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  function openEdit(member: StaffMember) {
    editForm.update("roleId", member.role.id);
    editForm.update("status", member.status);
    editForm.update("title", member.title ?? "");
    editForm.update("clinicIds", member.clinicIds);
    setEditing(member);
  }

  return (
    <div className="space-y-5">
      {banner ? (
        <Alert tone="info" icon={<Icon name="check" />}>
          {banner}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-muted-foreground">
          {members.length} {members.length === 1 ? "person" : "people"} · {invitations.length}{" "}
          pending {invitations.length === 1 ? "invitation" : "invitations"}
        </p>
        {canInvite ? (
          <Button onClick={() => setInviteOpen(true)} leadingIcon={<Icon name="plus" />}>
            Invite team member
          </Button>
        ) : null}
      </div>

      {invitations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{invitation.email}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {invitation.roleName} · expires {formatDate(invitation.expiresAt)} · invited by{" "}
                    {invitation.invitedBy}
                  </p>
                </div>
                {canInvite ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void revokeInvitation(invitation.id)}
                    loading={busyId === invitation.id}
                  >
                    Revoke
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Staff directory</CardTitle>
        </CardHeader>
        {members.length === 0 ? (
          <CardContent>
            <EmptyState title="No staff yet" description="Invite your first team member." />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Role</TH>
                <TH>Clinics</TH>
                <TH>Last sign-in</TH>
                <TH>Status</TH>
                {canManage ? <TH className="text-right">Actions</TH> : null}
              </TR>
            </THead>
            <TBody>
              {members.map((member) => (
                <TR key={member.membershipId}>
                  <TD>
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground">
                        {member.fullName}
                        {member.userId === currentUserId ? (
                          <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                            you
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{member.email}</p>
                      {member.title ? (
                        <p className="text-[11px] text-muted-foreground">{member.title}</p>
                      ) : null}
                    </div>
                  </TD>
                  <TD>
                    <Badge tone={member.role.systemKey === "org_admin" ? "info" : "neutral"}>
                      {member.role.name}
                    </Badge>
                  </TD>
                  <TD className="max-w-56 text-[12px] text-muted-foreground">
                    {clinicNames(member.clinicIds)}
                  </TD>
                  <TD className="text-[12px] text-muted-foreground">
                    {member.lastLoginAt ? formatDate(member.lastLoginAt) : "Never"}
                  </TD>
                  <TD>
                    <Badge tone={member.status === "ACTIVE" ? "success" : "warning"}>
                      {member.status === "ACTIVE" ? "Active" : "Suspended"}
                    </Badge>
                  </TD>
                  {canManage ? (
                    <TD className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(member)}>
                        Manage
                      </Button>
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Dialog
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          setCreatedLink(null);
        }}
        title="Invite a team member"
        description="They receive an email invitation, choose their own password and join with the access you set here."
        footer={
          createdLink ? (
            <Button
              onClick={() => {
                setInviteOpen(false);
                setCreatedLink(null);
                inviteForm.update("email", "");
                inviteForm.update("fullName", "");
                inviteForm.update("title", "");
                router.refresh();
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button
                loading={inviteForm.submitting}
                onClick={() =>
                  void inviteForm.submit(async (values) => {
                    const result = await apiRequest<{ devToken?: string }>("/staff/invitations", {
                      method: "POST",
                      body: values,
                    });
                    if (result.devToken) {
                      setCreatedLink(`${window.location.origin}/invite/${result.devToken}`);
                    } else {
                      setInviteOpen(false);
                      router.refresh();
                    }
                  })
                }
              >
                Send invitation
              </Button>
            </>
          )
        }
      >
        {createdLink ? (
          <div className="space-y-3">
            <Alert tone="warning" title="Email delivery is not configured in this build">
              No transactional email provider is connected yet, so the invitation link is shown
              here instead of being emailed. Give it to your team member directly.
            </Alert>
            <Field label="Invitation link" htmlFor="invitation-link">
              <Input
                id="invitation-link"
                readOnly
                value={createdLink}
                onFocus={(event) => event.currentTarget.select()}
              />
            </Field>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void inviteForm.submit(async (values) => {
                const result = await apiRequest<{ devToken?: string }>("/staff/invitations", {
                  method: "POST",
                  body: values,
                });
                if (result.devToken) {
                  setCreatedLink(`${window.location.origin}/invite/${result.devToken}`);
                } else {
                  setInviteOpen(false);
                  router.refresh();
                }
              });
            }}
          >
            {inviteForm.formError ? (
              <Alert tone="danger" icon={<Icon name="alert" />}>
                {inviteForm.formError}
              </Alert>
            ) : null}

            <Field label="Email" htmlFor="invite-email" errors={inviteForm.errors.email} required>
              <Input id="invite-email" type="email" {...inviteForm.bind("email")} />
            </Field>

            <Field label="Full name" htmlFor="invite-name" errors={inviteForm.errors.fullName}>
              <Input id="invite-name" {...inviteForm.bind("fullName")} />
            </Field>

            <Field label="Role" htmlFor="invite-role" errors={inviteForm.errors.roleId} required>
              <Select id="invite-role" {...inviteForm.bind("roleId")}>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Job title" htmlFor="invite-title" errors={inviteForm.errors.title}>
              <Input id="invite-title" placeholder="Senior Veterinarian" {...inviteForm.bind("title")} />
            </Field>

            <Field
              label="Clinic access"
              hint="Leave empty for all clinics"
              errors={inviteForm.errors.clinicIds}
            >
              <div className="space-y-1.5 rounded-md border border-border p-2.5">
                {clinics.map((clinic) => {
                  const selected = inviteForm.values.clinicIds?.includes(clinic.id) ?? false;
                  return (
                    <label key={clinic.id} className="flex items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--primary)]"
                        checked={selected}
                        onChange={(event) => {
                          const current = inviteForm.values.clinicIds ?? [];
                          inviteForm.update(
                            "clinicIds",
                            event.target.checked
                              ? [...current, clinic.id]
                              : current.filter((id) => id !== clinic.id),
                          );
                        }}
                      />
                      {clinic.name}
                    </label>
                  );
                })}
              </div>
            </Field>
          </form>
        )}
      </Dialog>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Manage ${editing.fullName}` : "Manage team member"}
        description="Changes take effect immediately and are recorded in the audit trail."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              loading={editForm.submitting}
              onClick={() =>
                void editForm.submit(async (values) => {
                  if (!editing) return;
                  await apiRequest(`/staff/${editing.membershipId}`, {
                    method: "PATCH",
                    body: {
                      roleId: values.roleId,
                      status: values.status,
                      title: values.title,
                      clinicIds: values.clinicIds,
                    },
                  });
                  setEditing(null);
                  setBanner(`${editing.fullName} updated.`);
                  router.refresh();
                })
              }
            >
              Save changes
            </Button>
          </>
        }
      >
        {editing ? (
          <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
            {editForm.formError ? (
              <Alert tone="danger" icon={<Icon name="alert" />}>
                {editForm.formError}
              </Alert>
            ) : null}

            <Field label="Role" htmlFor="edit-role" errors={editForm.errors.roleId}>
              <Select id="edit-role" {...editForm.bind("roleId")}>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Status" htmlFor="edit-status" errors={editForm.errors.status}>
              <Select id="edit-status" {...editForm.bind("status")}>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </Select>
            </Field>

            <Field label="Job title" htmlFor="edit-title" errors={editForm.errors.title}>
              <Input id="edit-title" {...editForm.bind("title")} />
            </Field>

            <Field
              label="Clinic access"
              hint="Leave empty for all clinics"
              errors={editForm.errors.clinicIds}
            >
              <div className="space-y-1.5 rounded-md border border-border p-2.5">
                {clinics.map((clinic) => {
                  const selected = editForm.values.clinicIds?.includes(clinic.id) ?? false;
                  return (
                    <label key={clinic.id} className="flex items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--primary)]"
                        checked={selected}
                        onChange={(event) => {
                          const current = editForm.values.clinicIds ?? [];
                          editForm.update(
                            "clinicIds",
                            event.target.checked
                              ? [...current, clinic.id]
                              : current.filter((id) => id !== clinic.id),
                          );
                        }}
                      />
                      {clinic.name}
                    </label>
                  );
                })}
              </div>
            </Field>
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}
