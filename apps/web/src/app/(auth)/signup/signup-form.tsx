"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signupSchema, type SessionPayload } from "@vetnex/shared";
import { Alert, Button, Field, Input, Select } from "@vetnex/ui";
import { apiRequest } from "@/lib/client-api";
import { useForm } from "@/lib/forms";
import { Icon } from "@/components/icons";
import { TIMEZONES } from "@vetnex/shared";

export function SignupForm() {
  const router = useRouter();
  const form = useForm(signupSchema, {
    organisationName: "",
    clinicName: "",
    fullName: "",
    email: "",
    password: "",
    timezone: "Australia/Sydney",
  });

  return (
    <div className="space-y-5">
      {form.formError ? (
        <Alert tone="danger" title="Could not create your practice" icon={<Icon name="alert" />}>
          {form.formError}
        </Alert>
      ) : null}

      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.submit((values) =>
            apiRequest<SessionPayload>("/auth/signup", { method: "POST", body: values }).then(() => {
              router.replace("/dashboard");
              router.refresh();
            }),
          );
        }}
      >
        <Field
          label="Practice name"
          htmlFor="organisationName"
          errors={form.errors.organisationName}
          required
        >
          <Input
            id="organisationName"
            autoComplete="organization"
            placeholder="Riverbend Veterinary Group"
            {...form.bind("organisationName")}
          />
        </Field>

        <Field label="First clinic" htmlFor="clinicName" errors={form.errors.clinicName} required>
          <Input
            id="clinicName"
            placeholder="Riverbend Main Hospital"
            {...form.bind("clinicName")}
          />
        </Field>

        <Field label="Your name" htmlFor="fullName" errors={form.errors.fullName} required>
          <Input id="fullName" autoComplete="name" placeholder="Dr Alex Morgan" {...form.bind("fullName")} />
        </Field>

        <Field label="Email" htmlFor="email" errors={form.errors.email} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@practice.vet"
            {...form.bind("email")}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          hint="At least 12 characters"
          errors={form.errors.password}
          required
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...form.bind("password")}
          />
        </Field>

        <Field label="Time zone" htmlFor="timezone" errors={form.errors.timezone}>
          <Select id="timezone" {...form.bind("timezone")}>
            {TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace("_", " ")}
              </option>
            ))}
          </Select>
        </Field>

        <Button type="submit" className="w-full" loading={form.submitting}>
          Create practice
        </Button>
      </form>

      <p className="text-[13px] text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
