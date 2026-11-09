"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Textarea,
} from "@vetnex/ui";
import { PERMISSION_DEFINITIONS, getPermissionDefinition } from "@vetnex/permissions";
import { createRoleSchema } from "@vetnex/shared";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { useForm } from "@/lib/forms";
import { Dialog } from "@/components/dialog";
import { Icon } from "@/components/icons";
import type { RoleRecord } from "@/lib/types";

const GROUPS = Array.from(new Set(PERMISSION_DEFINITIONS.map((entry) => entry.group)));

export function RoleManager({ roles, canManage }: { roles: RoleRecord[]; canManage: boolean }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRecord | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerTone, setBannerTone] = useState<"info" | "danger">("info");
  const [busy, setBusy] = useState(false);

  const form = useForm(createRoleSchema, { name: "", description: "", permissions: [] });

  useEffect(() => {
    form.update("permissions", selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function openCreate() {
    form.update("name", "");
    form.update("description", "");
    setSelected([]);
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(role: RoleRecord) {
    form.update("name", role.name);
    form.update("description", role.description ?? "");
    setSelected(role.permissions.filter((code) => code !== "*"));
    setEditing(role);
    setDialogOpen(true);
  }

  function toggle(code: string) {
    setSelected((current) =>
      current.includes(code) ? current.filter((entry) => entry !== code) : [...current, code],
    );
  }

  async function save() {
    await form.submit(async (values) => {
      const body = { ...values, permissions: selected };
      if (editing) {
        await apiRequest(`/roles/${editing.id}`, { method: "PATCH", body });
        setBanner(`${values.name} updated.`);
      } else {
        await apiRequest("/roles", { method: "POST", body });
        setBanner(`${values.name} created.`);
      }
      setDialogOpen(false);
      setBannerTone("info");
      router.refresh();
    });
  }

  async function remove(role: RoleRecord) {
    setBusy(true);
    try {
      await apiRequest(`/roles/${role.id}`, { method: "DELETE" });
      setBannerTone("info");
      setBanner(`${role.name} deleted.`);
      router.refresh();
    } catch (error) {
      setBannerTone("danger");
      setBanner(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {banner ? (
        <Alert tone={bannerTone} icon={<Icon name={bannerTone === "danger" ? "alert" : "check"} />}>
          {banner}
        </Alert>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          {roles.length} {roles.length === 1 ? "role" : "roles"}
        </p>
        {canManage ? (
          <Button onClick={openCreate} leadingIcon={<Icon name="plus" />}>
            Create role
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {roles.map((role) => {
          const isProtected = role.systemKey === "org_admin";
          return (
            <Card key={role.id} data-testid="role-card">
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    {role.name}
                    {role.isSystem ? <Badge tone="muted">Default</Badge> : null}
                  </CardTitle>
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    {role.description ?? "No description."}
                  </p>
                </div>
                <Badge tone="info">
                  {role.memberCount} {role.memberCount === 1 ? "person" : "people"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions.includes("*") ? (
                    <Badge tone="success">All permissions</Badge>
                  ) : (
                    role.permissions.map((code) => (
                      <Badge key={code} tone="neutral">
                        {getPermissionDefinition(code)?.label ?? code}
                      </Badge>
                    ))
                  )}
                  {role.permissions.length === 0 && !role.permissions.includes("*") ? (
                    <span className="text-[12px] text-muted-foreground">
                      No permissions granted
                    </span>
                  ) : null}
                </div>

                {canManage && !isProtected ? (
                  <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-3">
                    {!role.isSystem ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy || role.memberCount > 0}
                        title={
                          role.memberCount > 0
                            ? "Reassign staff before deleting this role"
                            : "Delete role"
                        }
                        onClick={() => void remove(role)}
                      >
                        Delete
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => openEdit(role)}>
                      Edit permissions
                    </Button>
                  </div>
                ) : null}
                {isProtected ? (
                  <p className="border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
                    The Owner role is protected so a practice can never lock itself out.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Create a role"}
        description="Only permissions enforced by shipped modules can be granted."
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button loading={form.submitting} onClick={() => void save()}>
              {editing ? "Save changes" : "Create role"}
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {form.formError ? (
            <Alert tone="danger" icon={<Icon name="alert" />}>
              {form.formError}
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role name" htmlFor="role-name" errors={form.errors.name} required>
              <Input id="role-name" placeholder="Inventory lead" {...form.bind("name")} />
            </Field>
            <Field label="Description" htmlFor="role-description" errors={form.errors.description}>
              <Input id="role-description" {...form.bind("description")} />
            </Field>
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <p className="text-[12px] font-semibold text-foreground">Permissions</p>
            {GROUPS.map((group) => (
              <div key={group} className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {group}
                </p>
                {PERMISSION_DEFINITIONS.filter((entry) => entry.group === group).map((entry) => {
                  const active = entry.status === "active";
                  const checked = selected.includes(entry.code) || Boolean(editing?.systemKey === "org_admin");
                  return (
                    <label
                      key={entry.code}
                      className={`flex items-start gap-2 text-[12.5px] ${active ? "" : "opacity-60"}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-3.5 accent-[var(--primary)]"
                        checked={checked}
                        disabled={!active || editing?.systemKey === "org_admin"}
                        onChange={() => toggle(entry.code)}
                      />
                      <span>
                        <span className="font-medium text-foreground">{entry.label}</span>
                        <span className="block text-[11px] leading-relaxed text-muted-foreground">
                          {entry.description}
                          {active ? "" : " (ships with a later module)"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>

          {form.errors.permissions ? (
            <p className="text-[12px] text-destructive">{form.errors.permissions.join(" ")}</p>
          ) : null}
          {form.errors.description ? (
            <p className="text-[12px] text-destructive">{form.errors.description.join(" ")}</p>
          ) : null}
        </form>
      </Dialog>
    </div>
  );
}
