import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthContext } from "../auth/auth.types";

export interface SetupStep {
  key: string;
  label: string;
  description: string;
  complete: boolean;
  href: string;
}

@Injectable()
export class DashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Phase 1 dashboard: real organisation data only.
   *
   * Appointment, hospital and billing figures appear here once those modules
   * exist — no placeholder metrics are returned.
   */
  async get(auth: AuthContext) {
    const organisationId = auth.organisation.id;
    const now = new Date();

    const [
      clinics,
      activeStaff,
      suspendedStaff,
      pendingInvitations,
      customRoleCount,
      recentAudit,
      organisation,
    ] = await Promise.all([
      this.prisma.clinic.findMany({
        where: { organisationId, deletedAt: null },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          addressLine1: true,
          phone: true,
          suburb: true,
          state: true,
          _count: { select: { membershipClinics: true, departments: true } },
        },
        orderBy: { name: "asc" },
      }),
      this.prisma.membership.count({
        where: { organisationId, deletedAt: null, status: "ACTIVE" },
      }),
      this.prisma.membership.count({
        where: { organisationId, deletedAt: null, status: "SUSPENDED" },
      }),
      this.prisma.invitation.count({
        where: {
          organisationId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      }),
      this.prisma.role.count({ where: { organisationId, isSystem: false } }),
      this.prisma.auditEvent.findMany({
        where: { organisationId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 6,
      }),
      this.prisma.organisation.findUnique({ where: { id: organisationId } }),
    ]);

    const setup: SetupStep[] = [
      {
        key: "clinic-details",
        label: "Complete your clinic details",
        description: "Add an address and phone number so documents and reminders are correct.",
        complete: clinics.some(
          (clinic) => Boolean(clinic.addressLine1) && Boolean(clinic.phone),
        ),
        href: "/clinics",
      },
      {
        key: "invite-team",
        label: "Invite your team",
        description: "Give each person their own account with the right role.",
        complete: activeStaff > 1 || pendingInvitations > 0,
        href: "/staff",
      },
      {
        key: "review-roles",
        label: "Review roles and access",
        description: "Default roles are a starting point; adjust who can see what.",
        complete: customRoleCount > 0,
        href: "/roles",
      },
      {
        key: "retention",
        label: "Confirm record retention",
        description: `Clinical records are retained for ${organisation?.retentionYearsClinical ?? 7} years by default.`,
        complete: true,
        href: "/settings/organisation",
      },
    ];

    return {
      organisation: {
        name: auth.organisation.name,
        timezone: auth.organisation.timezone,
        currency: auth.organisation.currency,
        gstRate: auth.organisation.gstRate,
      },
      metrics: {
        clinics: clinics.length,
        activeClinics: clinics.filter((clinic) => clinic.status === "ACTIVE").length,
        activeStaff,
        suspendedStaff,
        pendingInvitations,
        roleCount: customRoleCount,
      },
      clinics: clinics.map((clinic) => ({
        id: clinic.id,
        name: clinic.name,
        code: clinic.code,
        status: clinic.status,
        suburb: clinic.suburb,
        state: clinic.state,
        staffCount: clinic._count.membershipClinics,
        departmentCount: clinic._count.departments,
      })),
      setup,
      recentActivity: recentAudit.map((event) => ({
        id: event.id,
        action: event.action,
        summary: event.summary,
        actorLabel: event.actorLabel,
        createdAt: event.createdAt.toISOString(),
      })),
      scope: {
        roleName: auth.membership.roleName,
        clinicIds: auth.clinicIds,
      },
    };
  }
}
