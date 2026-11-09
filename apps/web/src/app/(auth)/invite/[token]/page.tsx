import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, CardContent } from "@vetnex/ui";
import { apiFetch, ApiError } from "@/lib/api";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Accept invitation" };
export const dynamic = "force-dynamic";

interface InvitationView {
  organisationName: string;
  email: string;
  fullName: string | null;
  title: string | null;
  roleName: string;
  clinicNames: string[];
  expiresAt: string;
  expired: boolean;
  accepted: boolean;
  revoked: boolean;
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let invitation: InvitationView | null = null;
  let failure: string | null = null;

  try {
    invitation = await apiFetch<InvitationView>(`/auth/invitation/${token}`, {
      authenticated: false,
    });
  } catch (error) {
    failure =
      error instanceof ApiError
        ? error.message
        : "We could not load this invitation. Check the link and try again.";
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Join your practice on VETNEX</h1>
        {invitation ? (
          <p className="text-sm text-muted-foreground">
            {invitation.organisationName} has invited you as{" "}
            <span className="font-medium text-foreground">{invitation.roleName}</span>.
          </p>
        ) : null}
      </div>

      {failure ? (
        <Alert tone="danger" title="Invitation unavailable">
          {failure}{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in instead
          </Link>
        </Alert>
      ) : null}

      {invitation ? (
        <>
          <Card>
            <CardContent className="space-y-2 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">{invitation.roleName}</Badge>
                {invitation.clinicNames.length > 0 ? (
                  <Badge tone="muted">{invitation.clinicNames.join(", ")}</Badge>
                ) : (
                  <Badge tone="muted">All clinics</Badge>
                )}
              </div>
              <p className="text-[13px] text-muted-foreground">
                Invitation for <span className="font-medium text-foreground">{invitation.email}</span>
                {invitation.title ? ` · ${invitation.title}` : ""}
              </p>
              <p className="text-[12px] text-muted-foreground">
                Expires {new Date(invitation.expiresAt).toLocaleString("en-AU")}
              </p>
            </CardContent>
          </Card>

          {invitation.accepted || invitation.revoked || invitation.expired ? (
            <Alert tone="warning" title="This invitation can no longer be used">
              {invitation.accepted
                ? "It has already been accepted. Sign in with your account instead."
                : invitation.revoked
                  ? "It was revoked by your practice. Ask them for a new invitation."
                  : "It has expired. Ask your practice manager for a new invitation."}
            </Alert>
          ) : (
            <InviteForm token={token} defaultName={invitation.fullName ?? ""} />
          )}
        </>
      ) : null}
    </div>
  );
}
