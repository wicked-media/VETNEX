import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  checkPasswordPolicy,
  generateToken,
  hashPassword,
  hashToken,
  passwordHashNeedsRehash,
  TOKEN_TTL,
  verifyPassword,
} from "@vetnex/authentication";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@vetnex/database";
import { SYSTEM_ROLES } from "@vetnex/permissions";
import {
  DEFAULT_TIMEZONE,
  LOGIN_LOCKOUT_MINUTES,
  LOGIN_MAX_FAILED_ATTEMPTS,
  type AcceptInvitationInput,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
  type SignupInput,
} from "@vetnex/shared";
import { env } from "../env";
import type { RequestMeta } from "../common/request";
import { AuditService } from "../audit/audit.service";
import { RateLimiter } from "../common/rate-limiter";
import type { AuthClinic, AuthContext } from "./auth.types";

/** A syntactically valid but unmatched hash, used to equalise timing for unknown emails. */
const TIMING_DUMMY_HASH =
  "scrypt$32768$8$1$c2FsdHNhbHRzYWx0c2FsdA==$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g=";

export interface SessionResult {
  token: string;
  auth: AuthContext;
}

export interface InvitationView {
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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(RateLimiter) private readonly rateLimiter: RateLimiter,
  ) {}

  /* ------------------------------------------------------------- sessions */

  async resolveAuth(token: string): Promise<AuthContext | null> {
    if (!token) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true, organisation: true },
    });
    if (!session) return null;
    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null;
    if (session.user.deletedAt || session.user.status !== "ACTIVE") return null;
    if (session.organisation.deletedAt || session.organisation.status !== "ACTIVE") return null;

    const membership = await this.prisma.membership.findUnique({
      where: {
        organisationId_userId: {
          organisationId: session.organisationId,
          userId: session.userId,
        },
      },
      include: { role: true, clinics: { include: { clinic: true } } },
    });
    if (!membership || membership.deletedAt || membership.status !== "ACTIVE") return null;
    if (membership.role.id !== membership.roleId) return null;

    const clinicFilter = membership.clinics.filter((entry) => entry.clinic.deletedAt === null);
    const clinics: AuthClinic[] =
      clinicFilter.length > 0
        ? clinicFilter.map((entry) => ({
            id: entry.clinic.id,
            name: entry.clinic.name,
            code: entry.clinic.code,
          }))
        : await this.prisma.clinic
            .findMany({
              where: {
                organisationId: session.organisationId,
                deletedAt: null,
                status: "ACTIVE",
              },
              select: { id: true, name: true, code: true },
              orderBy: { name: "asc" },
            })
            .then((rows) => rows);

    // Touch the session at most every five minutes to limit write amplification.
    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      await this.prisma.session
        .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    }

    return {
      session: { id: session.id, expiresAt: session.expiresAt },
      user: {
        id: session.user.id,
        email: session.user.email,
        fullName: session.user.fullName,
        status: session.user.status,
        mfaEnabled: session.user.mfaEnabled,
      },
      organisation: {
        id: session.organisation.id,
        name: session.organisation.name,
        slug: session.organisation.slug,
        timezone: session.organisation.timezone,
        currency: session.organisation.currency,
        gstRate: Number(session.organisation.gstRate),
        retentionYearsClinical: session.organisation.retentionYearsClinical,
      },
      membership: {
        id: membership.id,
        title: membership.title,
        roleId: membership.roleId,
        roleName: membership.role.name,
        roleKey: membership.role.systemKey,
        status: membership.status,
        permissions: membership.role.permissions,
      },
      permissions: membership.role.permissions,
      clinics,
      clinicIds: clinics.map((clinic) => clinic.id),
    };
  }

  private async createSession(
    userId: string,
    organisationId: string,
    meta: RequestMeta,
  ): Promise<string> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + env.sessionTtlHours * 60 * 60 * 1000);
    await this.prisma.session.create({
      data: {
        userId,
        organisationId,
        tokenHash: hashToken(token),
        ipAddress: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        expiresAt,
      },
    });
    return token;
  }

  async logout(auth: AuthContext | null, meta: RequestMeta): Promise<void> {
    if (!auth) return;
    await this.prisma.session.updateMany({
      where: { id: auth.session.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "user_signed_out" },
    });
    await this.audit.record({
      organisationId: auth.organisation.id,
      actorUserId: auth.user.id,
      actorLabel: `${auth.user.fullName} (${auth.user.email})`,
      action: "auth.signed_out",
      entityType: "Session",
      entityId: auth.session.id,
      summary: `${auth.user.fullName} signed out`,
      request: meta,
    });
  }

  async listSessions(auth: AuthContext) {
    const sessions = await this.prisma.session.findMany({
      where: { userId: auth.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { organisation: { select: { name: true } } },
      orderBy: { lastSeenAt: "desc" },
    });
    return sessions.map((session) => ({
      id: session.id,
      current: session.id === auth.session.id,
      organisationName: session.organisation.name,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    }));
  }

  async revokeSession(auth: AuthContext, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId: auth.user.id },
    });
    if (!session) {
      throw new NotFoundException({ code: "SESSION_NOT_FOUND", message: "Session not found." });
    }
    await this.prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "user_revoked" },
    });
    await this.audit.record({
      organisationId: auth.organisation.id,
      actorUserId: auth.user.id,
      actorLabel: `${auth.user.fullName} (${auth.user.email})`,
      action: "auth.session_revoked",
      entityType: "Session",
      entityId: session.id,
      summary: `${auth.user.fullName} revoked a signed-in device`,
    });
  }

  /* -------------------------------------------------------------- sign up */

  async signup(input: SignupInput, meta: RequestMeta): Promise<SessionResult> {
    this.assertRateLimit(`signup:${meta.ip ?? "unknown"}`, 20, 60 * 60 * 1000, "signup");

    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException({
        code: "EMAIL_IN_USE",
        message: "An account already exists for this email address. Sign in instead.",
      });
    }

    const passwordHash = await hashPassword(input.password);
    const slug = await this.uniqueSlug(input.organisationName);
    const clinicCode = deriveClinicCode(input.clinicName);

    const created = await this.prisma.$transaction(async (tx) => {
      const organisation = await tx.organisation.create({
        data: {
          name: input.organisationName,
          slug,
          timezone: input.timezone ?? DEFAULT_TIMEZONE,
        },
      });
      const clinic = await tx.clinic.create({
        data: {
          organisationId: organisation.id,
          name: input.clinicName,
          code: clinicCode,
          timezone: input.timezone ?? DEFAULT_TIMEZONE,
        },
      });
      await tx.department.createMany({
        data: ["Consulting", "Reception"].map((name) => ({ clinicId: clinic.id, name })),
      });

      let ownerRoleId: string | null = null;
      for (const definition of SYSTEM_ROLES) {
        const role = await tx.role.create({
          data: {
            organisationId: organisation.id,
            name: definition.name,
            description: definition.description,
            isSystem: true,
            systemKey: definition.key,
            permissions: [...definition.permissions],
          },
        });
        if (definition.key === "org_admin") ownerRoleId = role.id;
      }
      if (!ownerRoleId) throw new Error("Owner role was not provisioned");

      const user = await tx.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          passwordHash,
          status: "ACTIVE",
        },
      });
      const membership = await tx.membership.create({
        data: {
          organisationId: organisation.id,
          userId: user.id,
          roleId: ownerRoleId,
          title: "Owner",
          status: "ACTIVE",
        },
      });
      await tx.membershipClinic.create({
        data: { membershipId: membership.id, clinicId: clinic.id },
      });

      return { organisation, clinic, user };
    });

    await this.audit.record({
      organisationId: created.organisation.id,
      clinicId: created.clinic.id,
      actorUserId: created.user.id,
      actorLabel: `${created.user.fullName} (${created.user.email})`,
      action: "organisation.created",
      entityType: "Organisation",
      entityId: created.organisation.id,
      summary: `${created.organisation.name} created with first clinic ${created.clinic.name}`,
      metadata: { timezone: created.organisation.timezone, seeded: false },
      request: meta,
    });

    const token = await this.createSession(created.user.id, created.organisation.id, meta);
    const auth = await this.resolveAuth(token);
    if (!auth) throw new Error("Session could not be established after signup");
    return { token, auth };
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "practice";
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const clash = await this.prisma.organisation.findUnique({ where: { slug: candidate } });
      if (!clash) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  /* ---------------------------------------------------------------- login */

  async login(input: LoginInput, meta: RequestMeta): Promise<SessionResult> {
    this.assertRateLimit(
      `login:${input.email}:${meta.ip ?? "unknown"}`,
      10,
      15 * 60 * 1000,
      "sign-in",
    );

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.passwordHash) {
      await verifyPassword(input.password, TIMING_DUMMY_HASH);
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Email or password is incorrect.",
      });
    }

    if (user.deletedAt || user.status !== "ACTIVE") {
      throw new ForbiddenException({
        code: "ACCOUNT_DISABLED",
        message: "This account is disabled. Contact your practice owner.",
      });
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new HttpException(
        {
          code: "ACCOUNT_LOCKED",
          message: "Too many failed attempts. Try again in a few minutes.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      const failures = user.failedLoginCount + 1;
      const locked = failures >= LOGIN_MAX_FAILED_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: locked ? 0 : failures,
          lockedUntil: locked
            ? new Date(Date.now() + LOGIN_LOCKOUT_MINUTES * 60 * 1000)
            : null,
        },
      });
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Email or password is incorrect.",
      });
    }

    const memberships = await this.prisma.membership.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
        deletedAt: null,
        organisation: { status: "ACTIVE", deletedAt: null },
      },
      include: { organisation: true },
      orderBy: { createdAt: "asc" },
    });

    if (memberships.length === 0) {
      throw new ForbiddenException({
        code: "NO_ACTIVE_MEMBERSHIP",
        message: "Your account is not linked to an active practice.",
      });
    }

    const chosen = input.organisationId
      ? memberships.find((membership) => membership.organisationId === input.organisationId)
      : memberships.length === 1
        ? memberships[0]
        : undefined;

    if (input.organisationId && !chosen) {
      // Same message as a wrong password would allow probing of tenants; access is
      // only revealed to an already-authenticated user, so a clear error is safer UX.
      throw new ForbiddenException({
        code: "WORKSPACE_ACCESS_DENIED",
        message: "You do not have access to that practice.",
      });
    }

    if (!chosen) {
      throw new HttpException(
        {
          code: "ORGANISATION_SELECTION_REQUIRED",
          message: "Choose a practice to continue.",
          practices: memberships.map((membership) => ({
            id: membership.organisationId,
            name: membership.organisation.name,
          })),
        },
        HttpStatus.CONFLICT,
      );
    }

    const updateData: Prisma.UserUpdateInput = {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    };
    if (passwordHashNeedsRehash(user.passwordHash)) {
      updateData.passwordHash = await hashPassword(input.password);
    }
    await this.prisma.user.update({ where: { id: user.id }, data: updateData });

    const token = await this.createSession(user.id, chosen.organisationId, meta);
    const auth = await this.resolveAuth(token);
    if (!auth) throw new Error("Session could not be established after sign-in");

    await this.audit.record({
      organisationId: chosen.organisationId,
      actorUserId: user.id,
      actorLabel: `${user.fullName} (${user.email})`,
      action: "auth.signed_in",
      entityType: "Session",
      entityId: auth.session.id,
      summary: `${user.fullName} signed in`,
      request: meta,
    });

    return { token, auth };
  }

  /* ------------------------------------------------------ password resets */

  async requestPasswordReset(
    input: ForgotPasswordInput,
    meta: RequestMeta,
  ): Promise<{ ok: true; devToken?: string }> {
    this.assertRateLimit(
      `reset:${input.email}:${meta.ip ?? "unknown"}`,
      5,
      60 * 60 * 1000,
      "password reset",
    );

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || user.deletedAt) {
      // Do not disclose whether an account exists.
      return { ok: true };
    }

    const token = generateToken();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + TOKEN_TTL.passwordResetMinutes * 60 * 1000),
          requestedIp: meta.ip ?? null,
        },
      }),
    ]);

    if (env.devTokenDelivery) {
      this.logger.warn(
        `[development] Password reset token for ${user.email}: ${token} — no email provider is configured.`,
      );
      return { ok: true, devToken: token };
    }
    return { ok: true };
  }

  async resetPassword(input: ResetPasswordInput, meta: RequestMeta): Promise<{ ok: true }> {
    const policy = checkPasswordPolicy(input.password);
    if (!policy.ok) {
      throw new BadRequestException({
        code: "PASSWORD_POLICY",
        message: "Choose a stronger password.",
        fieldErrors: { password: policy.issues },
      });
    }

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(input.token) },
      include: { user: true },
    });

    if (
      !record ||
      record.usedAt !== null ||
      record.expiresAt.getTime() <= Date.now() ||
      record.user.deletedAt
    ) {
      throw new BadRequestException({
        code: "RESET_TOKEN_INVALID",
        message: "This reset link is invalid or has expired. Request a new one.",
      });
    }

    const passwordHash = await hashPassword(input.password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "password_reset" },
      }),
    ]);

    const membership = await this.prisma.membership.findFirst({
      where: { userId: record.userId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (membership) {
      await this.audit.record({
        organisationId: membership.organisationId,
        actorUserId: record.userId,
        actorLabel: `${record.user.fullName} (${record.user.email})`,
        action: "auth.password_reset",
        entityType: "User",
        entityId: record.userId,
        summary: `${record.user.fullName} reset their password and all sessions were revoked`,
        request: meta,
      });
    }

    return { ok: true };
  }

  /* ---------------------------------------------------------- invitations */

  async getInvitation(token: string): Promise<InvitationView> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { organisation: true, role: true },
    });
    if (!invitation) {
      throw new NotFoundException({
        code: "INVITATION_NOT_FOUND",
        message: "This invitation link is not valid.",
      });
    }

    const clinics =
      invitation.clinicIds.length > 0
        ? await this.prisma.clinic.findMany({
            where: { id: { in: invitation.clinicIds }, organisationId: invitation.organisationId },
            select: { name: true },
            orderBy: { name: "asc" },
          })
        : [];

    return {
      organisationName: invitation.organisation.name,
      email: invitation.email,
      fullName: invitation.fullName,
      title: invitation.title,
      roleName: invitation.role.name,
      clinicNames: clinics.map((clinic) => clinic.name),
      expiresAt: invitation.expiresAt.toISOString(),
      expired: invitation.expiresAt.getTime() <= Date.now(),
      accepted: invitation.acceptedAt !== null,
      revoked: invitation.revokedAt !== null,
    };
  }

  async acceptInvitation(
    token: string,
    input: AcceptInvitationInput,
    meta: RequestMeta,
  ): Promise<SessionResult> {
    this.assertRateLimit(`accept:${meta.ip ?? "unknown"}`, 20, 60 * 60 * 1000, "invitation");

    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { organisation: true, role: true },
    });

    if (!invitation) {
      throw new NotFoundException({
        code: "INVITATION_NOT_FOUND",
        message: "This invitation link is not valid.",
      });
    }
    if (invitation.acceptedAt) {
      throw new ConflictException({
        code: "INVITATION_ACCEPTED",
        message: "This invitation has already been used. Sign in instead.",
      });
    }
    if (invitation.revokedAt) {
      throw new GoneError("This invitation was revoked. Ask your practice manager for a new one.");
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new GoneError("This invitation has expired. Ask your practice manager for a new one.");
    }
    if (invitation.organisation.deletedAt || invitation.organisation.status !== "ACTIVE") {
      throw new ForbiddenException({
        code: "ORGANISATION_INACTIVE",
        message: "That practice is not currently active.",
      });
    }

    const policy = checkPasswordPolicy(input.password);
    if (!policy.ok) {
      throw new BadRequestException({
        code: "PASSWORD_POLICY",
        message: "Choose a stronger password.",
        fieldErrors: { password: policy.issues },
      });
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (existingUser?.passwordHash) {
      throw new ConflictException({
        code: "ACCOUNT_EXISTS",
        message:
          "An account already exists for this email. Sign in, then ask an owner to add you to this practice.",
      });
    }
    if (existingUser && (existingUser.deletedAt || existingUser.status !== "ACTIVE")) {
      throw new ForbiddenException({
        code: "ACCOUNT_DISABLED",
        message: "This account is disabled. Contact your practice owner.",
      });
    }

    const passwordHash = await hashPassword(input.password);
    const { user } = await this.prisma.$transaction(async (tx) => {
      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: { fullName: input.fullName, passwordHash, status: "ACTIVE" },
          })
        : await tx.user.create({
            data: {
              email: invitation.email,
              fullName: input.fullName,
              passwordHash,
              status: "ACTIVE",
            },
          });

      const membership = await tx.membership.upsert({
        where: {
          organisationId_userId: {
            organisationId: invitation.organisationId,
            userId: user.id,
          },
        },
        update: {
          roleId: invitation.roleId,
          title: invitation.title,
          status: "ACTIVE",
          deletedAt: null,
        },
        create: {
          organisationId: invitation.organisationId,
          userId: user.id,
          roleId: invitation.roleId,
          title: invitation.title,
          status: "ACTIVE",
        },
      });

      if (invitation.clinicIds.length > 0) {
        await tx.membershipClinic.createMany({
          data: invitation.clinicIds.map((clinicId) => ({
            membershipId: membership.id,
            clinicId,
          })),
          skipDuplicates: true,
        });
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return { user };
    });

    await this.audit.record({
      organisationId: invitation.organisationId,
      actorUserId: user.id,
      actorLabel: `${user.fullName} (${user.email})`,
      action: "staff.invitation_accepted",
      entityType: "Invitation",
      entityId: invitation.id,
      summary: `${user.fullName} accepted an invitation as ${invitation.role.name}`,
      request: meta,
    });

    const sessionToken = await this.createSession(
      user.id,
      invitation.organisationId,
      meta,
    );
    const auth = await this.resolveAuth(sessionToken);
    if (!auth) throw new Error("Session could not be established after accepting invitation");
    return { token: sessionToken, auth };
  }

  /* -------------------------------------------------------------- helpers */

  private assertRateLimit(key: string, limit: number, windowMs: number, label: string): void {
    if (!env.rateLimitsEnabled) return;
    const result = this.rateLimiter.hit(key, limit, windowMs);
    if (!result.allowed) {
      throw new HttpException(
        {
          code: "RATE_LIMITED",
          message: `Too many ${label} attempts. Try again in ${Math.ceil(
            result.retryAfterSeconds / 60,
          )} minute(s).`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}

/** 410 Gone, expressed inline so the error envelope stays consistent. */
class GoneError extends HttpException {
  constructor(message: string) {
    super({ code: "INVITATION_UNAVAILABLE", message }, HttpStatus.GONE);
  }
}

function deriveClinicCode(name: string): string {
  const cleaned = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 6);
  return cleaned.length >= 2 ? cleaned : "CLINIC";
}
