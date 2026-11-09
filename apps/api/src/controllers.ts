import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Request } from "express";
import {
  createClinicSchema,
  createRoleSchema,
  inviteStaffSchema,
  paginationSchema,
  updateClinicSchema,
  updateMembershipSchema,
  updateOrganisationSchema,
  updateRoleSchema,
} from "@vetnex/shared";
import { parseInput } from "./common/zod";
import { requestMeta } from "./common/request";
import { AuditService } from "./audit/audit.service";
import { CurrentAuth, Public, RequirePermission } from "./auth/decorators";
import type { AuthContext } from "./auth/auth.types";
import { ClinicsService } from "./clinics/clinics.service";
import { DashboardService } from "./dashboard/dashboard.service";
import { OrganisationService } from "./organisation/organisation.service";
import { RolesService } from "./roles/roles.service";
import { StaffService } from "./staff/staff.service";
import { PrismaService } from "./prisma/prisma.service";

@Controller("organisation")
export class OrganisationController {
  constructor(@Inject(OrganisationService) private readonly organisation: OrganisationService) {}

  @Get()
  @RequirePermission("organisation:read")
  get(@CurrentAuth() auth: AuthContext) {
    return this.organisation.get(auth);
  }

  @Patch()
  @RequirePermission("organisation:manage")
  update(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    return this.organisation.update(auth, parseInput(updateOrganisationSchema, body));
  }
}

@Controller("clinics")
export class ClinicsController {
  constructor(@Inject(ClinicsService) private readonly clinics: ClinicsService) {}

  @Get()
  @RequirePermission("clinic:read")
  list(@CurrentAuth() auth: AuthContext) {
    return this.clinics.list(auth);
  }

  @Post()
  @RequirePermission("clinic:manage")
  create(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    return this.clinics.create(auth, parseInput(createClinicSchema, body));
  }

  @Patch(":id")
  @RequirePermission("clinic:manage")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.clinics.update(auth, id, parseInput(updateClinicSchema, body));
  }
}

@Controller("staff")
export class StaffController {
  constructor(@Inject(StaffService) private readonly staff: StaffService) {}

  @Get()
  @RequirePermission("staff:read")
  list(@CurrentAuth() auth: AuthContext) {
    return this.staff.list(auth);
  }

  @Get("invitations")
  @RequirePermission("staff:read")
  listInvitations(@CurrentAuth() auth: AuthContext) {
    return this.staff.listInvitations(auth);
  }

  @Post("invitations")
  @RequirePermission("staff:invite")
  invite(
    @CurrentAuth() auth: AuthContext,
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    return this.staff.invite(auth, parseInput(inviteStaffSchema, body), requestMeta(request));
  }

  @Post("invitations/:id/revoke")
  @HttpCode(200)
  @RequirePermission("staff:invite")
  revokeInvitation(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Req() request: Request,
  ) {
    return this.staff.revokeInvitation(auth, id, requestMeta(request));
  }

  @Patch(":membershipId")
  @RequirePermission("staff:manage")
  updateMembership(
    @CurrentAuth() auth: AuthContext,
    @Param("membershipId") membershipId: string,
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    return this.staff.updateMembership(
      auth,
      membershipId,
      parseInput(updateMembershipSchema, body),
      requestMeta(request),
    );
  }
}

@Controller("roles")
export class RolesController {
  constructor(@Inject(RolesService) private readonly roles: RolesService) {}

  @Get()
  @RequirePermission("role:read")
  list(@CurrentAuth() auth: AuthContext) {
    return this.roles.list(auth);
  }

  @Post()
  @RequirePermission("role:manage")
  create(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    return this.roles.create(auth, parseInput(createRoleSchema, body));
  }

  @Patch(":id")
  @RequirePermission("role:manage")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.roles.update(auth, id, parseInput(updateRoleSchema, body));
  }

  @Delete(":id")
  @RequirePermission("role:manage")
  remove(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    return this.roles.remove(auth, id);
  }
}

@Controller("audit")
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  @RequirePermission("audit:read")
  list(@CurrentAuth() auth: AuthContext, @Query() query: unknown) {
    const pagination = parseInput(paginationSchema, query);
    return this.audit.list(auth.organisation.id, pagination);
  }
}

@Controller("dashboard")
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentAuth() auth: AuthContext) {
    return this.dashboard.get(auth);
  }
}

@Controller()
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Public()
  @Get("health")
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        code: "DATABASE_UNAVAILABLE",
        message: "The database is not reachable.",
      });
    }
    return {
      status: "ok",
      database: "ok",
      service: "vetnex-api",
      time: new Date().toISOString(),
    };
  }
}
