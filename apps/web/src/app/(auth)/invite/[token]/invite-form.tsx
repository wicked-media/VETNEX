"use client";

import { useRouter } from "next/navigation";
import { acceptInvitationSchema, type SessionPayload } from "@vetnex/shared";
import { Alert, Button, Field, Input } from "@vetnex/ui";
import { apiRequest } from "@/lib/client-api";
import { useForm } from "@/lib/forms";
import { Icon } from "@/components/icons";

export function InviteForm({ token, defaultName }: { token: string; defaultName: string }) {
  const router = useRouter();
  const form = useForm(acceptInvitationSchema, { fullName: defaultName, password: "" });

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit((values) =>
          apiRequest<SessionPayload>(`/auth/invitation/${token}/accept`, {
            method: "POST",
            body: values,
          }).then(() => {
            router.replace("/dashboard");
            router.refresh();
          }),
        );
      }}
    >
      {form.formError ? (
        <Alert tone="danger" icon={<Icon name="alert" />}>
          {form.formError}
        </Alert>
      ) : null}

      <Field label="Your full name" htmlFor="fullName" errors={form.errors.fullName} required>
        <Input id="fullName" autoComplete="name" {...form.bind("fullName")} />
      </Field>

      <Field
        label="Choose a password"
        htmlFor="password"
        hint="At least 12 characters"
        errors={form.errors.password}
        required
      >
        <Input id="password" type="password" autoComplete="new-password" {...form.bind("password")} />
      </Field>

      <Button type="submit" className="w-full" loading={form.submitting}>
        Join the practice
      </Button>
    </form>
  );
}
