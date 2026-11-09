"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginSchema, type SessionPayload } from "@vetnex/shared";
import { Alert, Button, Field, Input } from "@vetnex/ui";
import { apiRequest, ClientApiError } from "@/lib/client-api";
import { useForm } from "@/lib/forms";
import { Icon } from "@/components/icons";

interface Practice {
  id: string;
  name: string;
}

export function LoginForm({ showDemo }: { showDemo: boolean }) {
  const router = useRouter();
  const [practices, setPractices] = useState<Practice[] | null>(null);
  const form = useForm(loginSchema, { email: "", password: "" });

  async function submitWithOrganisation(organisationId?: string) {
    const payload: { email: string; password: string; organisationId?: string } = {
      email: form.values.email,
      password: form.values.password,
    };
    if (organisationId) payload.organisationId = organisationId;

    setPractices(null);
    try {
      await apiRequest<SessionPayload>("/auth/login", { method: "POST", body: payload });
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      if (error instanceof ClientApiError && error.code === "ORGANISATION_SELECTION_REQUIRED") {
        setPractices(error.practices ?? []);
        return;
      }
      throw error;
    }
  }

  return (
    <div className="space-y-5">
      {form.formError && !practices ? (
        <Alert tone="danger" title="Could not sign in" icon={<Icon name="alert" />}>
          {form.formError}
        </Alert>
      ) : null}

      {practices && practices.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <p className="text-[13px] font-medium">Choose a practice</p>
          <p className="text-[12px] text-muted-foreground">
            This account belongs to more than one practice.
          </p>
          <div className="space-y-2 pt-1">
            {practices.map((practice) => (
              <Button
                key={practice.id}
                variant="outline"
                className="w-full justify-between"
                loading={form.submitting}
                onClick={() => void form.submit(() => submitWithOrganisation(practice.id))}
              >
                {practice.name}
                <Icon name="chevronRight" />
              </Button>
            ))}
          </div>
          <button
            type="button"
            className="text-[12px] text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setPractices(null)}
          >
            Use a different account
          </button>
        </div>
      ) : (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void form.submit((values) =>
              apiRequest<SessionPayload>("/auth/login", { method: "POST", body: values }).then(() => {
                router.replace("/dashboard");
                router.refresh();
              }),
            );
          }}
        >
          <Field label="Email" htmlFor="email" errors={form.errors.email} required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@practice.vet"
              {...form.bind("email")}
            />
          </Field>

          <Field label="Password" htmlFor="password" errors={form.errors.password} required>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.bind("password")}
            />
          </Field>

          <div className="flex items-center justify-between">
            <Link
              href="/forgot-password"
              className="text-[12px] font-medium text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={form.submitting}>
            Sign in
          </Button>
        </form>
      )}

      <p className="text-[13px] text-muted-foreground">
        New practice?{" "}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>

      {showDemo ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
            <Icon name="key" size={14} /> Synthetic demo accounts
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Loaded by <code className="font-mono">pnpm db:seed</code>. Password for all accounts:{" "}
            <code className="font-mono">Vetnex-Demo-2026</code>
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            <li>
              <span className="font-mono">alex.morgan@riverbend.vet</span> — Owner
            </li>
            <li>
              <span className="font-mono">priya.raman@riverbend.vet</span> — Practice manager
            </li>
            <li>
              <span className="font-mono">tom.becker@riverbend.vet</span> — Veterinarian
            </li>
            <li>
              <span className="font-mono">locum@riverbend.vet</span> — Read-only observer
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
