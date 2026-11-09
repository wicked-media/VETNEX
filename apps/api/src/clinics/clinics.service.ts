import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateClinicInput, UpdateClinicInput } from "@vetnex/shared";
import { DEFAULT_TIMEZONE } from "@vetnex/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { actorLabelFor } from "../auth/current-user";
import type { AuthContext } from "../auth/auth.types";

@Injectable()
export class ClinicsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(auth: AuthContext) {
    const clinics = await this.prisma.clinic.findMany({
      where: { organisationId: auth.organisation.id, deletedAt: null },
      include: {
        departments: { orderBy: { name: "asc" } },
        _count: { select: { membershipClinics: true } },
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });

    return clinics.map((clinic) => this.serialise(clinic));
  }

  async create(auth: AuthContext, input: CreateClinicInput) {
    const duplicate = await this.prisma.clinic.findFirst({
      where: {
        organisationId: auth.organisation.id,
        code: input.code,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });
    if (duplicate) {
      throw new ConflictException({
        code: "CLINIC_CODE_IN_USE",
        message: `Clinic code ${input.code} is already used by ${duplicate.name}.`,
      });
    }

    const clinic = await this.prisma.$transaction(async (tx) => {
      const created = await tx.clinic.create({
        data: {
          organisationId: auth.organisation.id,
          name: input.name,
          code: input.code,
          timezone: input.timezone ?? auth.organisation.timezone ?? DEFAULT_TIMEZONE,
          phone: input.phone ?? null,
          email: input.email ?? null,
          addressLine1: input.addressLine1 ?? null,
          suburb: input.suburb ?? null,
          state: input.state ?? null,
          postcode: input.postcode && input.postcode.length > 0 ? input.postcode : null,
        },
      });
      await tx.department.createMany({
        data: ["Consulting", "Reception"].map((name) => ({ clinicId: created.id, name })),
      });
      return created;
    });

    await this.audit.record({
      organisationId: auth.organisation.id,
      clinicId: clinic.id,
      actorUserId: auth.user.id,
      actorLabel: actorLabelFor(auth),
      action: "clinic.created",
      entityType: "Clinic",
      entityId: clinic.id,
      summary: `Clinic ${clinic.name} (${clinic.code}) created`,
    });

    const withRelations = await this.prisma.clinic.findUniqueOrThrow({
      where: { id: clinic.id },
      include: {
        departments: { orderBy: { name: "asc" } },
        _count: { select: { membershipClinics: true } },
      },
    });
    return this.serialise(withRelations);
  }

  async update(auth: AuthContext, clinicId: string, input: UpdateClinicInput) {
    const existing = await this.prisma.clinic.findFirst({
      where: { id: clinicId, organisationId: auth.organisation.id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({ code: "CLINIC_NOT_FOUND", message: "Clinic not found." });
    }

    if (input.code && input.code !== existing.code) {
      const duplicate = await this.prisma.clinic.findFirst({
        where: {
          organisationId: auth.organisation.id,
          code: input.code,
          deletedAt: null,
          id: { not: existing.id },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({
          code: "CLINIC_CODE_IN_USE",
          message: `Clinic code ${input.code} is already in use.`,
        });
      }
    }

    if (input.state !== undefined && input.state.trim() === "") {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "Some fields need attention.",
        fieldErrors: { state: ["Choose a state or leave it empty."] },
      });
    }

    const data: Record<string, unknown> = {};
    for (const key of [
      "name",
      "code",
      "timezone",
      "phone",
      "email",
      "addressLine1",
      "suburb",
      "state",
      "status",
    ] as const) {
      if (input[key] !== undefined) data[key] = input[key];
    }
    if (input.postcode !== undefined) {
      data.postcode = input.postcode === "" ? null : input.postcode;
    }

    await this.prisma.clinic.update({ where: { id: existing.id }, data });

    await this.audit.record({
      organisationId: auth.organisation.id,
      clinicId: existing.id,
      actorUserId: auth.user.id,
      actorLabel: actorLabelFor(auth),
      action: "clinic.updated",
      entityType: "Clinic",
      entityId: existing.id,
      summary: `Clinic ${existing.name} updated`,
      metadata: { fields: Object.keys(data) },
    });

    const updated = await this.prisma.clinic.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        departments: { orderBy: { name: "asc" } },
        _count: { select: { membershipClinics: true } },
      },
    });
    return this.serialise(updated);
  }

  private serialise(clinic: {
    id: string;
    name: string;
    code: string;
    timezone: string;
    phone: string | null;
    email: string | null;
    addressLine1: string | null;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
    country: string;
    status: string;
    createdAt: Date;
    departments: Array<{ id: string; name: string }>;
    _count: { membershipClinics: number };
  }) {
    return {
      id: clinic.id,
      name: clinic.name,
      code: clinic.code,
      timezone: clinic.timezone,
      phone: clinic.phone,
      email: clinic.email,
      addressLine1: clinic.addressLine1,
      suburb: clinic.suburb,
      state: clinic.state,
      postcode: clinic.postcode,
      country: clinic.country,
      status: clinic.status,
      createdAt: clinic.createdAt.toISOString(),
      departments: clinic.departments.map((department) => ({
        id: department.id,
        name: department.name,
      })),
      staffCount: clinic._count.membershipClinics,
    };
  }
}
