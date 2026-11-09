import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@vetnex/ui";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">
          For security, every signed-in session will be ended once your password changes.
        </p>
      </div>

      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert tone="danger" title="Missing reset token">
          Open the link from your reset email again, or{" "}
          <Link href="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
            request a new one
          </Link>
          .
        </Alert>
      )}

      <p className="text-[13px] text-muted-foreground">
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
