import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Stat,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@vetnex/ui";
import { apiFetch } from "@/lib/api";
import { can } from "@/lib/navigation";
import { getSession } from "@/lib/session";
import type { DashboardData } from "@/lib/types";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function greetingFor(timezone: string): string {
  let hour = new Date().getHours();
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-AU", { hour: "numeric", hour12: false, timeZone: timezone }).format(
        new Date(),
      ),
    );
  } catch {
    // Fall back to server-local time when the time zone is not supported.
  }
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-AU", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString("en-AU");
  }
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const data = await apiFetch<DashboardData>("/dashboard");
  const firstName = session.user.fullName.replace(/^Dr\.?\s+/i, "").split(" ")[0] ?? "there";
  const completed = data.setup.filter((step) => step.complete).length;
  const isOwner = can(session.permissions, "organisation:manage");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${data.organisation.name} · ${session.membership.roleName}`}
        title={`${greetingFor(data.organisation.timezone)}, ${firstName}`}
        description="A live view of your practice setup. Clinical, scheduling and billing modules arrive in the next milestones — nothing here is simulated."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Active staff"
          value={data.metrics.activeStaff}
          hint={
            data.metrics.suspendedStaff > 0
              ? `${data.metrics.suspendedStaff} suspended`
              : "All accounts in good standing"
          }
          icon={<Icon name="staff" />}
        />
        <Stat
          label="Clinics"
          value={data.metrics.activeClinics}
          hint={`${data.metrics.clinics} total locations`}
          icon={<Icon name="clinics" />}
        />
        <Stat
          label="Pending invitations"
          value={data.metrics.pendingInvitations}
          hint="Expire after 72 hours"
          icon={<Icon name="clock" />}
        />
        <Stat
          label="Custom roles"
          value={data.metrics.roleCount}
          hint="Beyond the six defaults"
          icon={<Icon name="roles" />}
        />
      </div>

      {completed < data.setup.length ? (
        <Alert tone="warning" title="Finish setting up your practice" icon={<Icon name="alert" />}>
          {completed} of {data.setup.length} setup steps are complete. Completing them means
          documents, reminders and access all behave correctly from the first consultation.
        </Alert>
      ) : (
        <Alert tone="success" title="Foundation setup complete" icon={<Icon name="check" />}>
          Your organisation, clinics, team and roles are configured. The next milestone adds
          clients, patients and scheduling.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Setup checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {data.setup.map((step) => (
              <Link
                key={step.key}
                href={step.href}
                className="flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-muted"
              >
                <span
                  className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${
                    step.complete
                      ? "border-success/40 bg-success/15 text-success"
                      : "border-border bg-muted text-muted-foreground"
                  }`}
                  aria-hidden="true"
                >
                  {step.complete ? <Icon name="check" size={12} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-foreground">{step.label}</span>
                  <span className="block text-[12px] leading-relaxed text-muted-foreground">
                    {step.description}
                  </span>
                </span>
                <Icon name="chevronRight" size={15} className="mt-1 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentActivity.length === 0 ? (
              <EmptyState title="No activity yet" description="Actions appear here as they happen." />
            ) : (
              data.recentActivity.map((event) => (
                <div key={event.id} className="flex gap-2.5">
                  <span className="mt-1.5 block size-1.5 shrink-0 rounded-full bg-primary/60" />
                  <div className="min-w-0">
                    <p className="text-[13px] leading-snug text-foreground">{event.summary}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {event.actorLabel} · {timeAgo(event.createdAt, data.organisation.timezone)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
          {can(session.permissions, "audit:read") ? (
            <div className="border-t border-border px-4 py-2.5">
              <Link
                href="/audit"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
              >
                View full audit trail <Icon name="chevronRight" size={13} />
              </Link>
            </div>
          ) : null}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinics</CardTitle>
        </CardHeader>
        {data.clinics.length === 0 ? (
          <CardContent>
            <EmptyState
              title="No clinics yet"
              description="Add a clinic to start booking appointments and recording clinical notes."
            />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Clinic</TH>
                <TH>Code</TH>
                <TH>Location</TH>
                <TH>Team</TH>
                <TH>Departments</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {data.clinics.map((clinic) => (
                <TR key={clinic.id}>
                  <TD className="font-medium text-foreground">{clinic.name}</TD>
                  <TD className="font-mono text-[12px] text-muted-foreground">{clinic.code}</TD>
                  <TD className="text-muted-foreground">
                    {[clinic.suburb, clinic.state].filter(Boolean).join(", ") || "—"}
                  </TD>
                  <TD className="tabular-nums">{clinic.staffCount}</TD>
                  <TD className="tabular-nums">{clinic.departmentCount}</TD>
                  <TD>
                    <Badge tone={clinic.status === "ACTIVE" ? "success" : "muted"}>
                      {clinic.status === "ACTIVE" ? "Active" : "Inactive"}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>Administrator notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
            <p>
              This build covers the platform foundation: organisations, clinics, team access, roles,
              audit history and regional defaults. Clients, patients, scheduling, clinical records
              and billing are the next milestones and are not present yet.
            </p>
            <p>
              No AI features are enabled. When they arrive, clinical documentation will require
              explicit clinician review and will never be finalised automatically.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
