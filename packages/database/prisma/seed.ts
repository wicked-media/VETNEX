/**
 * Synthetic development seed for VETNEX.
 *
 * All data here is fabricated for local development and automated tests. It must
 * never be loaded into a production environment. Re-running the seed is safe: it
 * upserts by natural keys and only writes sample audit rows once.
 */
import { hashPassword } from "@vetnex/authentication";
import { SYSTEM_ROLES } from "@vetnex/permissions";
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Vetnex-Demo-2026";

const STAFF = [
  {
    email: "alex.morgan@riverbend.vet",
    fullName: "Dr Alex Morgan",
    title: "Practice Owner",
    roleKey: "org_admin" as const,
    clinics: ["RBMH", "RBSF"],
  },
  {
    email: "priya.raman@riverbend.vet",
    fullName: "Priya Raman",
    title: "Practice Manager",
    roleKey: "practice_manager" as const,
    clinics: ["RBMH"],
  },
  {
    email: "tom.becker@riverbend.vet",
    fullName: "Dr Tom Becker",
    title: "Senior Veterinarian",
    roleKey: "veterinarian" as const,
    clinics: ["RBMH"],
  },
  {
    email: "sara.lee@riverbend.vet",
    fullName: "Sara Lee",
    title: "Head Nurse",
    roleKey: "nurse" as const,
    clinics: ["RBMH"],
  },
  {
    email: "jess.kelly@riverbend.vet",
    fullName: "Jess Kelly",
    title: "Client Services",
    roleKey: "receptionist" as const,
    clinics: ["RBMH", "RBSF"],
  },
  {
    email: "locum@riverbend.vet",
    fullName: "Dr Nadia Osei",
    title: "Locum (read-only)",
    roleKey: "observer" as const,
    clinics: ["RBSF"],
  },
];

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const organisation = await prisma.organisation.upsert({
    where: { slug: "riverbend" },
    update: {},
    create: {
      name: "Riverbend Veterinary Group",
      slug: "riverbend",
      timezone: "Australia/Sydney",
      currency: "AUD",
      gstRate: 0.1,
      retentionYearsClinical: 7,
    },
  });

  const clinicSeeds = [
    {
      code: "RBMH",
      name: "Riverbend Main Hospital",
      phone: "(03) 9123 4500",
      addressLine1: "148 Bridge Road",
      suburb: "Richmond",
      state: "VIC",
      postcode: "3121",
      departments: ["Consulting", "Surgery", "Hospital Ward", "Reception"],
    },
    {
      code: "RBSF",
      name: "Riverbend Seaford",
      phone: "(03) 9123 4555",
      addressLine1: "7 Nepean Highway",
      suburb: "Seaford",
      state: "VIC",
      postcode: "3198",
      departments: ["Consulting", "Reception"],
    },
  ];

  const clinics = new Map<string, string>();
  for (const seed of clinicSeeds) {
    const clinic = await prisma.clinic.upsert({
      where: { organisationId_code: { organisationId: organisation.id, code: seed.code } },
      update: {},
      create: {
        organisationId: organisation.id,
        name: seed.name,
        code: seed.code,
        timezone: "Australia/Sydney",
        phone: seed.phone,
        addressLine1: seed.addressLine1,
        suburb: seed.suburb,
        state: seed.state,
        postcode: seed.postcode,
      },
    });
    clinics.set(seed.code, clinic.id);
    for (const name of seed.departments) {
      await prisma.department.upsert({
        where: { clinicId_name: { clinicId: clinic.id, name } },
        update: {},
        create: { clinicId: clinic.id, name },
      });
    }
  }

  const roles = new Map<string, string>();
  for (const definition of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: {
        organisationId_systemKey: { organisationId: organisation.id, systemKey: definition.key },
      },
      update: { name: definition.name, description: definition.description },
      create: {
        organisationId: organisation.id,
        name: definition.name,
        description: definition.description,
        isSystem: true,
        systemKey: definition.key,
        permissions: [...definition.permissions],
      },
    });
    roles.set(definition.key, role.id);
  }

  for (const staff of STAFF) {
    const user = await prisma.user.upsert({
      where: { email: staff.email },
      update: { fullName: staff.fullName, status: "ACTIVE" },
      create: {
        email: staff.email,
        fullName: staff.fullName,
        passwordHash,
        status: "ACTIVE",
      },
    });

    const roleId = roles.get(staff.roleKey);
    if (!roleId) throw new Error(`missing seeded role ${staff.roleKey}`);

    const membership = await prisma.membership.upsert({
      where: {
        organisationId_userId: { organisationId: organisation.id, userId: user.id },
      },
      update: { roleId, title: staff.title, status: "ACTIVE" },
      create: {
        organisationId: organisation.id,
        userId: user.id,
        roleId,
        title: staff.title,
        status: "ACTIVE",
      },
    });

    for (const code of staff.clinics) {
      const clinicId = clinics.get(code);
      if (!clinicId) continue;
      await prisma.membershipClinic.upsert({
        where: { membershipId_clinicId: { membershipId: membership.id, clinicId } },
        update: {},
        create: { membershipId: membership.id, clinicId },
      });
    }
  }

  const configSeeds = [
    { key: "notifications.email.enabled", value: false },
    { key: "clinical.amendmentWindowDays", value: 24 },
  ];
  for (const seed of configSeeds) {
    const existing = await prisma.configuration.findFirst({
      where: { organisationId: organisation.id, clinicId: null, key: seed.key },
    });
    if (!existing) {
      await prisma.configuration.create({
        data: { organisationId: organisation.id, key: seed.key, value: seed.value },
      });
    }
  }

  const auditCount = await prisma.auditEvent.count({
    where: { organisationId: organisation.id },
  });
  if (auditCount === 0) {
    const owner = await prisma.user.findUnique({ where: { email: STAFF[0]!.email } });
    const mainClinicId = clinics.get("RBMH") ?? null;
    const events = [
      {
        action: "organisation.created",
        entityType: "Organisation",
        entityId: organisation.id,
        summary: "Organisation Riverbend Veterinary Group created",
      },
      {
        action: "clinic.created",
        entityType: "Clinic",
        entityId: mainClinicId,
        summary: "Clinic Riverbend Main Hospital created",
      },
      {
        action: "staff.invited",
        entityType: "Invitation",
        entityId: null,
        summary: "Dr Tom Becker invited as Veterinarian",
      },
      {
        action: "role.updated",
        entityType: "Role",
        entityId: roles.get("practice_manager") ?? null,
        summary: "Practice Manager role permissions reviewed",
      },
      {
        action: "staff.signed_in",
        entityType: "User",
        entityId: owner?.id ?? null,
        summary: "Dr Alex Morgan signed in",
      },
    ];
    for (const [index, event] of events.entries()) {
      await prisma.auditEvent.create({
        data: {
          organisationId: organisation.id,
          clinicId: mainClinicId,
          actorUserId: owner?.id ?? null,
          actorLabel: owner ? `${owner.fullName} (${owner.email})` : "System",
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          summary: event.summary,
          metadata: { seeded: true },
          requestId: `seed-${index + 1}`,
          createdAt: new Date(Date.now() - (events.length - index) * 45 * 60 * 1000),
        },
      });
    }
  }

  console.log(
    [
      "Synthetic VETNEX data ready.",
      `  Organisation: ${organisation.name} (${organisation.slug})`,
      `  Staff accounts (development only) use password: ${DEMO_PASSWORD}`,
      ...STAFF.map((staff) => `    - ${staff.email} (${staff.title})`),
    ].join("\n"),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
