"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPasswordSchema } from "@vetnex/shared";
import { Alert, Button, Field, Input } from "@vetnex/ui";
import { apiRequest } from "@/lib/client-api";
import { useForm } from "@/lib/forms";
import { Icon } from "@/components/icons";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const form = useForm(forgotPasswordSchema, { email: "" });

  if (sent) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Check your email" icon={<Icon name="check" />}>
          If an account exists for {form.values.email}, a reset link has been generated.
        </Alert>

        {devToken ? (
          <Alert tone="warning" title="Email delivery is not configured in this build">
            No transactional email provider is connected yet, so the link is shown here instead.
            <Link
              href={`/reset-password?token=${devToken}`}
              className="mt-2 block font-medium text-primary underline-offset-4 hover:underline"
            >
              Continue to reset your password
            </Link>
          </Alert>
        ) : null}

        <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
          Use a different email
        </Button>
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
          const result = await apiRequest<{ ok: true; devToken?: string }>("/auth/password/forgot", {
            method: "POST",
            body: values,
          });
          setDevToken(result.devToken ?? null);
          setSent(true);
        });
      }}
    >
      {form.formError ? (
        <Alert tone="danger" icon={<Icon name="alert" />}>
          {form.formError}
        </Alert>
      ) : null}

      <Field label="Email" htmlFor="email" errors={form.errors.email} required>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@practice.vet"
          {...form.bind("email")}
        />
      </Field>

      <Button type="submit" className="w-full" loading={form.submitting}>
        Send reset link
      </Button>
    </form>
  );
}
