import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createApp, getRoleId, signupPractice } from "./helpers";

describe("tenant isolation", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("scopes clinic reads to the caller's organisation", async () => {
    const alpha = await signupPractice(app, { organisationName: "Alpha Vet", clinicName: "Alpha One" });
    const beta = await signupPractice(app, { organisationName: "Beta Vet", clinicName: "Beta One" });

    const alphaClinics = await request(app.getHttpServer())
      .get("/clinics")
      .set("Cookie", alpha.cookie)
      .expect(200);
    expect(alphaClinics.body.map((clinic: { name: string }) => clinic.name)).toEqual(["Alpha One"]);

    const betaClinics = await request(app.getHttpServer())
      .get("/clinics")
      .set("Cookie", beta.cookie)
      .expect(200);
    expect(betaClinics.body.map((clinic: { name: string }) => clinic.name)).toEqual(["Beta One"]);
  });

  it("cannot read or modify another tenant's clinic by id", async () => {
    const alpha = await signupPractice(app, { organisationName: "Alpha Second" });
    const beta = await signupPractice(app, { organisationName: "Beta Second" });

    await request(app.getHttpServer())
      .patch(`/clinics/${beta.clinicId}`)
      .set("Cookie", alpha.cookie)
      .send({ name: "Hijacked clinic" })
      .expect(404);

    const betaStillIntact = await request(app.getHttpServer())
      .get("/clinics")
      .set("Cookie", beta.cookie)
      .expect(200);
    expect(betaStillIntact.body[0].name).not.toBe("Hijacked clinic");
  });

  it("cannot use another tenant's role when inviting staff", async () => {
    const alpha = await signupPractice(app, { organisationName: "Alpha Third" });
    const beta = await signupPractice(app, { organisationName: "Beta Third" });
    const betaRoleId = await getRoleId(app, beta.cookie, "veterinarian");

    const response = await request(app.getHttpServer())
      .post("/staff/invitations")
      .set("Cookie", alpha.cookie)
      .send({ email: "someone@alpha.vet", roleId: betaRoleId })
      .expect(400);
    expect(response.body.error.code).toBe("ROLE_NOT_FOUND");
  });

  it("cannot attach another tenant's clinic to a team member", async () => {
    const alpha = await signupPractice(app, { organisationName: "Alpha Fourth" });
    const beta = await signupPractice(app, { organisationName: "Beta Fourth" });
    const roleId = await getRoleId(app, alpha.cookie, "nurse");

    const response = await request(app.getHttpServer())
      .post("/staff/invitations")
      .set("Cookie", alpha.cookie)
      .send({ email: "nurse@alpha.vet", roleId, clinicIds: [beta.clinicId] })
      .expect(400);
    expect(response.body.error.code).toBe("INVALID_CLINIC");
  });

  it("cannot modify a membership in another tenant", async () => {
    const alpha = await signupPractice(app, { organisationName: "Alpha Fifth" });
    const beta = await signupPractice(app, { organisationName: "Beta Fifth" });

    const betaStaff = await request(app.getHttpServer())
      .get("/staff")
      .set("Cookie", beta.cookie)
      .expect(200);
    const betaOwnerMembership = betaStaff.body[0].membershipId as string;

    await request(app.getHttpServer())
      .patch(`/staff/${betaOwnerMembership}`)
      .set("Cookie", alpha.cookie)
      .send({ status: "SUSPENDED" })
      .expect(404);

    // The beta owner can still sign in, proving the record was untouched.
    await request(app.getHttpServer())
      .get("/dashboard")
      .set("Cookie", beta.cookie)
      .expect(200);
  });

  it("cannot read another tenant's audit trail", async () => {
    const alpha = await signupPractice(app, {
      organisationName: "Alpha Audit",
      clinicName: "Alpha Audit Clinic",
    });
    await signupPractice(app, {
      organisationName: "Beta Audit",
      clinicName: "Beta Audit Clinic",
    });

    const audit = await request(app.getHttpServer())
      .get("/audit?limit=50")
      .set("Cookie", alpha.cookie)
      .expect(200);

    const serialised = JSON.stringify(audit.body);
    expect(serialised).toContain("Alpha Audit");
    expect(serialised).not.toContain("Beta Audit");
  });

  it("keeps dashboard metrics scoped to the caller's organisation", async () => {
    const alpha = await signupPractice(app, {
      organisationName: "Alpha Metrics",
      clinicName: "Alpha Metrics Clinic",
    });
    const beta = await signupPractice(app, {
      organisationName: "Beta Metrics",
      clinicName: "Beta Metrics Clinic",
    });

    const alphaDashboard = await request(app.getHttpServer())
      .get("/dashboard")
      .set("Cookie", alpha.cookie)
      .expect(200);
    expect(alphaDashboard.body.organisation.name).toBe("Alpha Metrics");
    expect(alphaDashboard.body.metrics.clinics).toBe(1);
    expect(alphaDashboard.body.clinics[0].name).toBe("Alpha Metrics Clinic");

    const betaDashboard = await request(app.getHttpServer())
      .get("/dashboard")
      .set("Cookie", beta.cookie)
      .expect(200);
    expect(betaDashboard.body.organisation.name).toBe("Beta Metrics");
    expect(betaDashboard.body.clinics[0].name).toBe("Beta Metrics Clinic");
  });

  it("isolates the same person working across two practices", async () => {
    const first = await signupPractice(app, { organisationName: "First Practice" });
    const second = await signupPractice(app, { organisationName: "Second Practice" });

    // Signing in with an explicit organisation selects that tenant context.
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: first.email,
        password: "Vetnex-Test-Password-1",
        organisationId: second.organisationId,
      })
      .expect(403);
    expect(login.body.error.code).toBe("WORKSPACE_ACCESS_DENIED");
  });
});
