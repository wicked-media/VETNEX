"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Alert, Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Field, Input, Select } from "@vetnex/ui";
import { TIMEZONES, timezoneSchema } from "@vetnex/shared";
import { apiRequest } from "@/lib/client-api";
import { useForm } from "@/lib/forms";
import { Icon } from "@/components/icons";
import type { OrganisationDetail } from "@/lib/types";

const settingsSchema = z.object({
  name: z.string().trim().min(2, "Enter your practice name.").max(120, "Practice name is too long."),
  timezone: timezoneSchema,
  gstPercent: z
    .string()
    .regex(/^\d{1,2}(\.\d{1,2})?$/, "Enter a percentage, for example 10 or 10.5.")
    .transform((value) => Number(value)),
  retentionYears: z
    .string()
    .regex(/^\d{1,2}$/, "Enter a whole number of years.")
    .transform((value) => Number(value)),
});

export function OrganisationForm({
  organisation,
  canManage,
}: {
  organisation: OrganisationDetail;
  canManage: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  const form = useForm(settingsSchema, {
    name: organisation.name,
    timezone: organisation.timezone as (typeof TIMEZONES)[number],
    gstPercent: String(Math.round(organisation.gstRate * 10000) / 100),
    retentionYears: String(organisation.retentionYearsClinical),
  });

  return (
    <Card>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canManage) return;
          void form.submit(async (values) => {
            await apiRequest("/organisation", {
              method: "PATCH",
              body: {
                name: values.name,
                timezone: values.timezone,
                gstRate: values.gstPercent / 100,
                retentionYearsClinical: values.retentionYears,
              },
            });
            setSaved(true);
            router.refresh();
          });
        }}
      >
        <CardHeader>
          <CardTitle>Practice profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canManage ? (
            <Alert tone="info" icon={<Icon name="shield" />}>
              You can view these settings but not change them. An owner or practice manager can
              update them.
            </Alert>
          ) : null}
          {saved && form.formError === null ? (
            <Alert tone="success" icon={<Icon name="check" />}>
              Settings saved.
            </Alert>
          ) : null}
          {form.formError ? (
            <Alert tone="danger" icon={<Icon name="alert" />}>
              {form.formError}
            </Alert>
          ) : null}

          <Field label="Practice name" htmlFor="org-name" errors={form.errors.name} required>
            <Input id="org-name" disabled={!canManage} {...form.bind("name")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Time zone" htmlFor="org-timezone" errors={form.errors.timezone}>
              <Select id="org-timezone" disabled={!canManage} {...form.bind("timezone")}>
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="GST rate (%)"
              htmlFor="org-gst"
              hint="Applied to invoices"
              errors={form.errors.gstPercent}
            >
              <Input id="org-gst" inputMode="decimal" disabled={!canManage} {...form.bind("gstPercent")} />
            </Field>
          </div>

          <Field
            label="Clinical record retention (years)"
            htmlFor="org-retention"
            hint="Configurable — confirm against your jurisdiction"
            errors={form.errors.retentionYears}
          >
            <Input
              id="org-retention"
              inputMode="numeric"
              disabled={!canManage}
              {...form.bind("retentionYears")}
            />
          </Field>

          <div className="rounded-md border border-border/70 bg-muted/40 p-3 text-[12px] text-muted-foreground">
            <p>
              Organisation slug: <span className="font-mono">{organisation.slug}</span> · Created{" "}
              {new Date(organisation.createdAt).toLocaleDateString("en-AU")}
            </p>
            <p className="mt-1">
              {organisation.counts.activeStaff} active staff · {organisation.counts.clinics} clinics
              · {organisation.counts.pendingInvitations} pending invitations
            </p>
          </div>
        </CardContent>
        {canManage ? (
          <CardFooter className="justify-end">
            <Button type="submit" loading={form.submitting}>
              Save settings
            </Button>
          </CardFooter>
        ) : null}
      </form>
    </Card>
  );
}
