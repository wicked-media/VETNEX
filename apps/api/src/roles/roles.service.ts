import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InvalidPermissionError, validateGrantablePermissions } from "@vetnex/permissions";
import type { CreateRoleInput, UpdateRoleInput } from "@vetnex/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { actorLabelFor } from "../auth/current-user";
import type { AuthContext } from "../auth/auth.types";

@Injectable()
export class RolesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(auth: AuthContext) {
    const roles = await this.prisma.role.findMany({
      where: { organisationId: auth.organisation.id },
      include: { _count: { select: { memberships: true } } },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      systemKey: role.systemKey,
      permissions: role.permissions,
      memberCount: role._count.memberships,
      createdAt: role.createdAt.toISOString(),
    }));
  }

  async create(auth: AuthContext, input: CreateRoleInput) {
    const permissions = this.validatePermissions(input.permissions);
    const duplicate = await this.prisma.role.findFirst({
      where: { organisationId: auth.organisation.id, name: input.name },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException({
        code: "ROLE_NAME_IN_USE",
        message: "A role with that name already exists.",
      });
    }

    const role = await this.prisma.role.create({
      data: {
        organisationId: auth.organisation.id,
        name: input.name,
        description: input.description ?? null,
        isSystem: false,
        permissions: [...permissions],
      },
    });

    await this.audit.record({
      organisationId: auth.organisation.id,
      actorUserId: auth.user.id,
      actorLabel: actorLabelFor(auth),
      action: "role.created",
      entityType: "Role",
      entityId: role.id,
      summary: `Role ${role.name} created with ${permissions.length} permission(s)`,
      metadata: { permissions },
    });

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      systemKey: role.systemKey,
      permissions: role.permissions,
      memberCount: 0,
      createdAt: role.createdAt.toISOString(),
    };
  }

  async update(auth: AuthContext, roleId: string, input: UpdateRoleInput) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organisationId: auth.organisation.id },
    });
    if (!role) {
      throw new NotFoundException({ code: "ROLE_NOT_FOUND", message: "Role not found." });
    }
    // The Owner role is the break-glass role: allowing edits could lock a practice
    // out of its own administration.
    if (role.systemKey === "org_admin") {
      throw new ForbiddenException({
        code: "ROLE_PROTECTED",
        message: "The Owner role cannot be edited. Create a custom role instead.",
      });
    }

    const permissions =
      input.permissions !== undefined ? this.validatePermissions(input.permissions) : undefined;

    if (input.name && input.name !== role.name) {
      const duplicate = await this.prisma.role.findFirst({
        where: {
          organisationId: auth.organisation.id,
          name: input.name,
          id: { not: role.id },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({
          code: "ROLE_NAME_IN_USE",
          message: "A role with that name already exists.",
        });
      }
    }

    const updated = await this.prisma.role.update({
      where: { id: role.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(permissions !== undefined ? { permissions: [...permissions] } : {}),
      },
    });

    await this.audit.record({
      organisationId: auth.organisation.id,
      actorUserId: auth.user.id,
      actorLabel: actorLabelFor(auth),
      action: "role.updated",
      entityType: "Role",
      entityId: role.id,
      summary: `Role ${updated.name} updated`,
      metadata: {
        permissionsBefore: role.permissions,
        permissionsAfter: updated.permissions,
      },
    });

    const memberCount = await this.prisma.membership.count({ where: { roleId: role.id } });
    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      isSystem: updated.isSystem,
      systemKey: updated.systemKey,
      permissions: updated.permissions,
      memberCount,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async remove(auth: AuthContext, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organisationId: auth.organisation.id },
      include: { _count: { select: { memberships: true } } },
    });
    if (!role) {
      throw new NotFoundException({ code: "ROLE_NOT_FOUND", message: "Role not found." });
    }
    if (role.isSystem) {
      throw new ConflictException({
        code: "ROLE_PROTECTED",
        message: "Default roles cannot be deleted. Rename or edit them instead.",
      });
    }
    if (role._count.memberships > 0) {
      throw new ConflictException({
        code: "ROLE_IN_USE",
        message: "Reassign the staff using this role before deleting it.",
      });
    }

    await this.prisma.role.delete({ where: { id: role.id } });

    await this.audit.record({
      organisationId: auth.organisation.id,
      actorUserId: auth.user.id,
      actorLabel: actorLabelFor(auth),
      action: "role.deleted",
      entityType: "Role",
      entityId: role.id,
      summary: `Role ${role.name} deleted`,
    });

    return { ok: true };
  }

  private validatePermissions(permissions: string[]): readonly string[] {
    try {
      return validateGrantablePermissions(permissions);
    } catch (error) {
      if (error instanceof InvalidPermissionError) {
        throw new BadRequestException({
          code: "INVALID_PERMISSION",
          message:
            "Some selected permissions are not available in this release because the feature they guard has not shipped.",
          fieldErrors: { permissions: [error.message] },
        });
      }
      throw error;
    }
  }
}
