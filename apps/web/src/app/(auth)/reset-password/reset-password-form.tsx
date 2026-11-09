"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { passwordSchema } from "@vetnex/shared";
import { Alert, Button, Field, Input } from "@vetnex/ui";
import { apiRequest } from "@/lib/client-api";
import { useForm } from "@/lib/forms";
import { Icon } from "@/components/icons";

const resetSchema = z
  .object({
    token: z.string().min(10),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const form = useForm(resetSchema, { token, password: "", confirmPassword: "" });

  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Password updated" icon={<Icon name="check" />}>
          All sessions have been signed out. Use your new password to sign in.
        </Alert>
        <Link
          href="/login"
          className="inline-flex h-9.5 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit(async (values) => {
          await apiRequest("/auth/password/reset", {
            method: "POST",
            body: { token: values.token, password: values.password },
          });
          setDone(true);
        });
      }}
    >
      {form.formError ? (
        <Alert tone="danger" icon={<Icon name="alert" />}>
          {form.formError}
        </Alert>
      ) : null}

      <Field
        label="New password"
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

      <Field
        label="Confirm password"
        htmlFor="confirmPassword"
        errors={form.errors.confirmPassword}
        required
      >
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...form.bind("confirmPassword")}
        />
      </Field>

      <Button type="submit" className="w-full" loading={form.submitting}>
        Update password
      </Button>
    </form>
  );
}
