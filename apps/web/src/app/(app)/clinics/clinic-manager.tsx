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
  Field,
  Input,
  Select,
} from "@vetnex/ui";
import { AU_STATES, TIMEZONES, createClinicSchema } from "@vetnex/shared";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { useForm } from "@/lib/forms";
import { Dialog } from "@/components/dialog";
import { Icon } from "@/components/icons";
import type { ClinicRecord } from "@/lib/types";

interface Props {
  clinics: ClinicRecord[];
  canManage: boolean;
  organisationTimezone: string;
}

export function ClinicManager({ clinics, canManage, organisationTimezone }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ClinicRecord | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerTone, setBannerTone] = useState<"info" | "danger">("info");

  const defaultTimezone = organisationTimezone as (typeof TIMEZONES)[number];

  const createForm = useForm(createClinicSchema, {
    name: "",
    code: "",
    timezone: defaultTimezone,
    phone: "",
    email: "",
    addressLine1: "",
    suburb: "",
    state: "",
    postcode: "",
  });

  const editForm = useForm(createClinicSchema, {
    name: "",
    code: "",
    timezone: defaultTimezone,
    phone: "",
    email: "",
    addressLine1: "",
    suburb: "",
    state: "",
    postcode: "",
  });
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  function openEdit(clinic: ClinicRecord) {
    editForm.update("name", clinic.name);
    editForm.update("code", clinic.code);
    editForm.update("timezone", clinic.timezone as (typeof TIMEZONES)[number]);
    editForm.update("phone", clinic.phone ?? "");
    editForm.update("email", clinic.email ?? "");
    editForm.update("addressLine1", clinic.addressLine1 ?? "");
    editForm.update("suburb", clinic.suburb ?? "");
    editForm.update(
      "state",
      (clinic.state ?? "") as "" | (typeof AU_STATES)[number]["code"],
    );
    editForm.update("postcode", clinic.postcode ?? "");
    setEditStatus(clinic.status);
    setEditing(clinic);
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
          {clinics.length} {clinics.length === 1 ? "clinic" : "clinics"}
        </p>
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)} leadingIcon={<Icon name="plus" />}>
            Add clinic
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {clinics.map((clinic) => (
          <Card key={clinic.id}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>{clinic.name}</CardTitle>
                <p className="font-mono text-[11px] text-muted-foreground">{clinic.code}</p>
              </div>
              <Badge tone={clinic.status === "ACTIVE" ? "success" : "muted"}>
                {clinic.status === "ACTIVE" ? "Active" : "Inactive"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-0.5 text-[13px] text-muted-foreground">
                <p>
                  {[clinic.addressLine1, clinic.suburb, clinic.state, clinic.postcode]
                    .filter(Boolean)
                    .join(", ") || "No address recorded"}
                </p>
                <p>{clinic.phone ?? "No phone recorded"}</p>
                <p className="text-[11px]">{clinic.timezone.replace("_", " ")}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {clinic.departments.map((department) => (
                  <Badge key={department.id} tone="muted">
                    {department.name}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border/70 pt-3">
                <p className="text-[12px] text-muted-foreground">
                  {clinic.staffCount} {clinic.staffCount === 1 ? "staff member" : "staff members"}
                </p>
                {canManage ? (
                  <Button variant="outline" size="sm" onClick={() => openEdit(clinic)}>
                    Edit
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add a clinic"
        description="Clinics share the organisation's staff and roles but keep their own address, time zone and departments."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={createForm.submitting}
              onClick={() =>
                void createForm.submit(async (values) => {
                  await apiRequest("/clinics", { method: "POST", body: values });
                  setCreateOpen(false);
                  setBannerTone("info");
                  setBanner(`Clinic ${values.name} added.`);
                  router.refresh();
                })
              }
            >
              Add clinic
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void createForm.submit(async (values) => {
              await apiRequest("/clinics", { method: "POST", body: values });
              setCreateOpen(false);
              setBannerTone("info");
              setBanner(`Clinic ${values.name} added.`);
              router.refresh();
            });
          }}
        >
          {createForm.formError ? (
            <Alert tone="danger" icon={<Icon name="alert" />}>
              {createForm.formError}
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="clinic-name" errors={createForm.errors.name} required>
              <Input id="clinic-name" placeholder="Riverbend Seaford" {...createForm.bind("name")} />
            </Field>
            <Field
              label="Code"
              htmlFor="clinic-code"
              hint="2–8 characters"
              errors={createForm.errors.code}
              required
            >
              <Input id="clinic-code" placeholder="SEAFORD" className="font-mono uppercase" {...createForm.bind("code")} />
            </Field>
          </div>

          <Field label="Phone" htmlFor="clinic-phone" errors={createForm.errors.phone}>
            <Input id="clinic-phone" placeholder="(03) 9123 4500" {...createForm.bind("phone")} />
          </Field>

          <Field label="Email" htmlFor="clinic-email" errors={createForm.errors.email}>
            <Input id="clinic-email" type="email" {...createForm.bind("email")} />
          </Field>

          <Field label="Street address" htmlFor="clinic-address" errors={createForm.errors.addressLine1}>
            <Input id="clinic-address" {...createForm.bind("addressLine1")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Suburb" htmlFor="clinic-suburb" errors={createForm.errors.suburb}>
              <Input id="clinic-suburb" {...createForm.bind("suburb")} />
            </Field>
            <Field label="State" htmlFor="clinic-state" errors={createForm.errors.state}>
              <Select id="clinic-state" {...createForm.bind("state")}>
                <option value="">—</option>
                {AU_STATES.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.code}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Postcode" htmlFor="clinic-postcode" errors={createForm.errors.postcode}>
              <Input id="clinic-postcode" inputMode="numeric" maxLength={4} {...createForm.bind("postcode")} />
            </Field>
          </div>

          <Field label="Time zone" htmlFor="clinic-timezone" errors={createForm.errors.timezone}>
            <Select id="clinic-timezone" {...createForm.bind("timezone")}>
              {TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replace("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : "Edit clinic"}
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
                  await apiRequest(`/clinics/${editing.id}`, {
                    method: "PATCH",
                    body: { ...values, status: editStatus },
                  });
                  setEditing(null);
                  setBannerTone("info");
                  setBanner(`${values.name} updated.`);
                  router.refresh();
                })
              }
            >
              Save changes
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
          {editForm.formError ? (
            <Alert tone="danger" icon={<Icon name="alert" />}>
              {editForm.formError}
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="edit-clinic-name" errors={editForm.errors.name}>
              <Input id="edit-clinic-name" {...editForm.bind("name")} />
            </Field>
            <Field label="Code" htmlFor="edit-clinic-code" errors={editForm.errors.code}>
              <Input id="edit-clinic-code" className="font-mono uppercase" {...editForm.bind("code")} />
            </Field>
          </div>

          <Field label="Status" htmlFor="edit-clinic-status">
            <Select
              id="edit-clinic-status"
              value={editStatus}
              onChange={(event) => setEditStatus(event.target.value as "ACTIVE" | "INACTIVE")}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>

          <Field label="Phone" htmlFor="edit-clinic-phone" errors={editForm.errors.phone}>
            <Input id="edit-clinic-phone" {...editForm.bind("phone")} />
          </Field>

          <Field label="Street address" htmlFor="edit-clinic-address" errors={editForm.errors.addressLine1}>
            <Input id="edit-clinic-address" {...editForm.bind("addressLine1")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Suburb" htmlFor="edit-clinic-suburb" errors={editForm.errors.suburb}>
              <Input id="edit-clinic-suburb" {...editForm.bind("suburb")} />
            </Field>
            <Field label="State" htmlFor="edit-clinic-state" errors={editForm.errors.state}>
              <Select id="edit-clinic-state" {...editForm.bind("state")}>
                <option value="">—</option>
                {AU_STATES.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.code}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Postcode" htmlFor="edit-clinic-postcode" errors={editForm.errors.postcode}>
              <Input id="edit-clinic-postcode" maxLength={4} {...editForm.bind("postcode")} />
            </Field>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
