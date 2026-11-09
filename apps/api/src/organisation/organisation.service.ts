import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@vetnex/database";
import type { UpdateOrganisationInput } from "@vetnex/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { actorLabelFor } from "../auth/current-user";
import type { AuthContext } from "../auth/auth.types";

@Injectable()
export class OrganisationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async get(auth: AuthContext) {
    const organisation = await this.prisma.organisation.findFirst({
      where: { id: auth.organisation.id, deletedAt: null },
    });
    if (!organisation) {
      throw new NotFoundException({
        code: "ORGANISATION_NOT_FOUND",
        message: "Organisation not found.",
      });
    }
    const [clinics, activeStaff, pendingInvitations] = await Promise.all([
      this.prisma.clinic.count({ where: { organisationId: organisation.id, deletedAt: null } }),
      this.prisma.membership.count({
        where: { organisationId: organisation.id, deletedAt: null, status: "ACTIVE" },
      }),
      this.prisma.invitation.count({
        where: {
          organisationId: organisation.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    return {
      id: organisation.id,
      name: organisation.name,
      slug: organisation.slug,
      timezone: organisation.timezone,
      currency: organisation.currency,
      locale: organisation.locale,
      gstRate: Number(organisation.gstRate),
      retentionYearsClinical: organisation.retentionYearsClinical,
      createdAt: organisation.createdAt.toISOString(),
      counts: { clinics, activeStaff, pendingInvitations },
    };
  }

  async update(auth: AuthContext, input: UpdateOrganisationInput) {
    const before = await this.get(auth);

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const data: Prisma.OrganisationUpdateInput = {};

    if (input.name !== undefined && input.name !== before.name) {
      changes.name = { from: before.name, to: input.name };
      data.name = input.name;
    }
    if (input.timezone !== undefined && input.timezone !== before.timezone) {
      changes.timezone = { from: before.timezone, to: input.timezone };
      data.timezone = input.timezone;
    }
    if (input.gstRate !== undefined && input.gstRate !== before.gstRate) {
      changes.gstRate = { from: before.gstRate, to: input.gstRate };
      data.gstRate = new Prisma.Decimal(input.gstRate);
    }
    if (
      input.retentionYearsClinical !== undefined &&
      input.retentionYearsClinical !== before.retentionYearsClinical
    ) {
      changes.retentionYearsClinical = {
        from: before.retentionYearsClinical,
        to: input.retentionYearsClinical,
      };
      data.retentionYearsClinical = input.retentionYearsClinical;
    }

    if (Object.keys(changes).length === 0) return before;

    await this.prisma.organisation.update({
      where: { id: auth.organisation.id },
      data,
    });

    await this.audit.record({
      organisationId: auth.organisation.id,
      actorUserId: auth.user.id,
      actorLabel: actorLabelFor(auth),
      action: "organisation.updated",
      entityType: "Organisation",
      entityId: auth.organisation.id,
      summary: `Organisation settings updated: ${Object.keys(changes).join(", ")}`,
      metadata: { changes },
    });

    return this.get(auth);
  }
}
