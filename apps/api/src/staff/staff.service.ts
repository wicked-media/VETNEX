import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { generateToken, hashToken, TOKEN_TTL } from "@vetnex/authentication";
import { hasPermission } from "@vetnex/permissions";
import type { InviteStaffInput, UpdateMembershipInput } from "@vetnex/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { actorLabelFor } from "../auth/current-user";
import type { AuthContext } from "../auth/auth.types";
import { env } from "../env";
import type { RequestMeta } from "../common/request";

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(auth: AuthContext) {
    const memberships = await this.prisma.membership.findMany({
      where: { organisationId: auth.organisation.id, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, fullName: true, lastLoginAt: true, status: true } },
        role: { select: { id: true, name: true, systemKey: true } },
        clinics: { select: { clinicId: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });

    return memberships.map((membership) => ({
      membershipId: membership.id,
      userId: membership.userId,
      fullName: membership.user.fullName,
      email: membership.user.email,
      accountStatus: membership.user.status,
      lastLoginAt: membership.user.lastLoginAt?.toISOString() ?? null,
      title: membership.title,
      status: membership.status,
      role: {
        id: membership.role.id,
        name: membership.role.name,
        systemKey: membership.role.systemKey,
      },
      clinicIds: membership.clinics.map((clinic) => clinic.clinicId),
      createdAt: membership.createdAt.toISOString(),
    }));
  }

  async listInvitations(auth: AuthContext) {
    const invitations = await this.prisma.invitation.findMany({
      where: {
        organisationId: auth.organisation.id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        role: { select: { name: true } },
        invitedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      fullName: invitation.fullName,
      title: invitation.title,
      roleName: invitation.role.name,
      invitedBy: invitation.invitedBy.fullName,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    }));
  }

  async invite(auth: AuthContext, input: InviteStaffInput, meta: RequestMeta) {
    const role = await this.prisma.role.findFirst({
      where: { id: input.roleId, organisationId: auth.organisation.id },
    });
    if (!role) {
      throw new BadRequestException({
        code: "ROLE_NOT_FOUND",
        message: "Choose a role that belongs to this practice.",
        fieldErrors: { roleId: ["Choose a valid role."] },
      });
    }

    if (role.systemKey === "org_admin" && !hasPermission(auth.permissions, "organisation:manage")) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Only an owner can invite another owner.",
      });
    }

    const clinicIds = await this.validatedClinicIds(auth, input.clinicIds);

    const existingMember = await this.prisma.membership.findFirst({
      where: {
        organisationId: auth.organisation.id,
        user: { email: input.email },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existingMember) {
      throw new ConflictException({
        code: "ALREADY_A_MEMBER",
        message: "That person is already part of this practice.",
      });
    }

    const token = generateToken();
    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: {
          organisationId: auth.organisation.id,
          email: input.email,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      return tx.invitation.create({
        data: {
          organisationId: auth.organisation.id,
          email: input.email,
          fullName: input.fullName ?? null,
          title: input.title ?? null,
          roleId: role.id,
          clinicIds,
          invitedById: auth.user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + TOKEN_TTL.invitationHours * 60 * 60 * 1000),
        },
      });
    });

    await this.audit.record({
      organisationId: auth.organisation.id,
      actorUserId: auth.user.id,
      actorLabel: actorLabelFor(auth),
      action: "staff.invited",
      entityType: "Invitation",
      entityId: invitation.id,
      summary: `${input.email} invited as ${role.name}`,
      metadata: { roleId: role.id, clinicIds },
      request: meta,
    });

    const response: Record<string, unknown> = {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        roleName: role.name,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    };

    if (env.devTokenDelivery) {
      // No transactional email provider is configured in this milestone, so the
      // invitation token is returned to the inviting user instead of being emailed.
      this.logger.warn(
        `[development] Invitation token for ${input.email}: ${token} — no email provider is configured.`,
      );
      response.devToken = token;
    }

    return response;
  }

  async revokeInvitation(auth: AuthContext, invitationId: string, meta: RequestMeta) {
    const invitation = await this.prisma.invitation.findFirst({
      where: {
        id: invitationId,
        organisationId: auth.organisation.id,
        acceptedAt: null,
        revokedAt: null,
      },
    });
    if (!invitation) {
      throw new NotFoundException({
        code: "INVITATION_NOT_FOUND",
        message: "That invitation is no longer pending.",
      });
    }

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      organisationId: auth.organisation.id,
      actorUserId: auth.user.id,
      actorLabel: actorLabelFor(auth),
      action: "staff.invitation_revoked",
      entityType: "Invitation",
      entityId: invitation.id,
      summary: `Invitation for ${invitation.email} revoked`,
      request: meta,
    });

    return { ok: true };
  }

  async updateMembership(
    auth: AuthContext,
    membershipId: string,
    input: UpdateMembershipInput,
    meta: RequestMeta,
  ) {
    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, organisationId: auth.organisation.id, deletedAt: null },
      include: { user: true, role: true },
    });
    if (!target) {
      throw new NotFoundException({
        code: "MEMBERSHIP_NOT_FOUND",
        message: "That team member could not be found.",
      });
    }

    let nextRole: { id: string; name: string; systemKey: string | null } | null = null;
    if (input.roleId && input.roleId !== target.roleId) {
      nextRole = await this.prisma.role.findFirst({
        where: { id: input.roleId, organisationId: auth.organisation.id },
        select: { id: true, name: true, systemKey: true },
      });
      if (!nextRole) {
        throw new BadRequestException({
          code: "ROLE_NOT_FOUND",
          message: "Choose a role that belongs to this practice.",
        });
      }
      if (nextRole.systemKey === "org_admin" && !hasPermission(auth.permissions, "organisation:manage")) {
        throw new ForbiddenException({
          code: "FORBIDDEN",
          message: "Only an owner can promote someone to owner.",
        });
      }
    }

    const losingOwner =
      target.role.systemKey === "org_admin" &&
      ((input.status !== undefined && input.status !== "ACTIVE") ||
        (nextRole !== null && nextRole.systemKey !== "org_admin"));

    if (losingOwner) {
      const otherOwners = await this.prisma.membership.count({
        where: {
          organisationId: auth.organisation.id,
          deletedAt: null,
          status: "ACTIVE",
          userId: { not: target.userId },
          role: { systemKey: "org_admin" },
        },
      });
      if (otherOwners === 0) {
        throw new ConflictException({
          code: "LAST_OWNER",
          message: "A practice must always have at least one active owner.",
        });
      }
    }

    const clinicIds =
      input.clinicIds !== undefined
        ? await this.validatedClinicIds(auth, input.clinicIds)
        : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.membership.update({
        where: { id: target.id },
        data: {
          ...(input.roleId ? { roleId: input.roleId } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
        },
      });

      if (clinicIds) {
        await tx.membershipClinic.deleteMany({ where: { membershipId: target.id } });
        if (clinicIds.length > 0) {
          await tx.membershipClinic.createMany({
            data: clinicIds.map((clinicId) => ({ membershipId: target.id, clinicId })),
            skipDuplicates: true,
          });
        }
      }
    });

    await this.audit.record({
      organisationId: auth.organisation.id,
      actorUserId: auth.user.id,
      actorLabel: actorLabelFor(auth),
      action: "staff.updated",
      entityType: "Membership",
      entityId: target.id,
      summary: `Access updated for ${target.user.fullName}`,
      metadata: {
        ...(input.roleId
          ? { role: { from: target.role.name, to: nextRole?.name ?? null } }
          : {}),
        ...(input.status ? { status: { from: target.status, to: input.status } } : {}),
        ...(clinicIds ? { clinicIds } : {}),
      },
      request: meta,
    });

    const members = await this.list(auth);
    return members.find((member) => member.membershipId === target.id) ?? null;
  }

  private async validatedClinicIds(
    auth: AuthContext,
    clinicIds: string[] | undefined,
  ): Promise<string[]> {
    if (!clinicIds || clinicIds.length === 0) return [];
    const unique = [...new Set(clinicIds)];
    const found = await this.prisma.clinic.count({
      where: { id: { in: unique }, organisationId: auth.organisation.id, deletedAt: null },
    });
    if (found !== unique.length) {
      throw new BadRequestException({
        code: "INVALID_CLINIC",
        message: "One or more selected clinics do not belong to this practice.",
        fieldErrors: { clinicIds: ["Choose clinics from this practice."] },
      });
    }
    return unique;
  }
}
