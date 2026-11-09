import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { RateLimiter } from "./common/rate-limiter";
import { PrismaService } from "./prisma/prisma.service";
import { AuditService } from "./audit/audit.service";
import { AuthService } from "./auth/auth.service";
import { AuthGuard } from "./auth/auth.guard";
import { PermissionsGuard } from "./auth/permissions.guard";
import { AuthController } from "./auth/auth.controller";
import { OrganisationService } from "./organisation/organisation.service";
import { ClinicsService } from "./clinics/clinics.service";
import { StaffService } from "./staff/staff.service";
import { RolesService } from "./roles/roles.service";
import { DashboardService } from "./dashboard/dashboard.service";
import { OpenApiController } from "./openapi/openapi.controller";
import {
  AuditController,
  ClinicsController,
  DashboardController,
  HealthController,
  OrganisationController,
  RolesController,
  StaffController,
} from "./controllers";

@Module({
  controllers: [
    HealthController,
    AuthController,
    OrganisationController,
    ClinicsController,
    StaffController,
    RolesController,
    AuditController,
    DashboardController,
    OpenApiController,
  ],
  providers: [
    PrismaService,
    RateLimiter,
    AuditService,
    AuthService,
    OrganisationService,
    ClinicsService,
    StaffService,
    RolesService,
    DashboardService,
    // Order matters: authentication resolves the tenant context before any
    // permission check runs.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
