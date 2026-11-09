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

  describe("cross-tenant records", () => {
    it("never lists another tenant's staff", async () => {
      const alpha = await signupPractice(app, { organisationName: "Alpha Roster", fullName: "Alice Alpha" });
      const beta = await signupPractice(app, { organisationName: "Beta Roster", fullName: "Bruno Beta" });

      const alphaStaff = await request(app.getHttpServer())
        .get("/staff")
        .set("Cookie", alpha.cookie)
        .expect(200);
      const alphaEmails = (alphaStaff.body as Array<{ email: string; userId: string }>).map(
        (member) => member.email,
      );
      expect(alphaEmails).toEqual([alpha.email]);
      expect(alphaEmails).not.toContain(beta.email);
      expect((alphaStaff.body as Array<{ userId: string }>).map((member) => member.userId)).not.toContain(
        beta.userId,
      );

      const betaStaff = await request(app.getHttpServer())
        .get("/staff")
        .set("Cookie", beta.cookie)
        .expect(200);
      expect((betaStaff.body as Array<{ email: string }>).map((member) => member.email)).toEqual([
        beta.email,
      ]);
    });

    it("refuses to change another tenant's staff member", async () => {
      const alpha = await signupPractice(app, { organisationName: "Alpha Memberships" });
      const beta = await signupPractice(app, { organisationName: "Beta Memberships" });

      const betaStaff = await request(app.getHttpServer())
        .get("/staff")
        .set("Cookie", beta.cookie)
        .expect(200);
      const target = (
        betaStaff.body as Array<{ membershipId: string; status: string; title: string | null }>
      )[0];
      if (!target) throw new Error("Expected the beta owner to have a membership");

      const response = await request(app.getHttpServer())
        .patch(`/staff/${target.membershipId}`)
        .set("Cookie", alpha.cookie)
        .send({ status: "SUSPENDED", title: "Hijacked title" })
        .expect(404);
      expect(response.body.error.code).toBe("MEMBERSHIP_NOT_FOUND");

      const betaStaffAfter = await request(app.getHttpServer())
        .get("/staff")
        .set("Cookie", beta.cookie)
        .expect(200);
      const unchanged = (
        betaStaffAfter.body as Array<{ membershipId: string; status: string; title: string | null }>
      ).find((member) => member.membershipId === target.membershipId);
      expect(unchanged?.status).toBe("ACTIVE");
      expect(unchanged?.title).toBe(target.title);
    });

    it("refuses to revoke another tenant's staff invitation", async () => {
      const alpha = await signupPractice(app, { organisationName: "Alpha Invitations" });
      const beta = await signupPractice(app, { organisationName: "Beta Invitations" });
      const roleId = await getRoleId(app, beta.cookie, "nurse");

      const invitation = await request(app.getHttpServer())
        .post("/staff/invitations")
        .set("Cookie", beta.cookie)
        .send({ email: "nurse@beta-invitations.vet", roleId, clinicIds: [] })
        .expect(201);
      const invitationId = (invitation.body as { invitation: { id: string } }).invitation.id;

      const attempt = await request(app.getHttpServer())
        .post(`/staff/invitations/${invitationId}/revoke`)
        .set("Cookie", alpha.cookie)
        .expect(404);
      expect(attempt.body.error.code).toBe("INVITATION_NOT_FOUND");

      // Still pending for the tenant that owns it.
      const pending = await request(app.getHttpServer())
        .get("/staff/invitations")
        .set("Cookie", beta.cookie)
        .expect(200);
      expect((pending.body as Array<{ id: string }>).map((entry) => entry.id)).toContain(invitationId);
    });

    it("does not expose another tenant's clinic and leaves it unchanged", async () => {
      const alpha = await signupPractice(app, {
        organisationName: "Alpha Premises",
        clinicName: "Alpha Premises Clinic",
      });
      const beta = await signupPractice(app, {
        organisationName: "Beta Premises",
        clinicName: "Beta Premises Clinic",
      });

      const betaBefore = await request(app.getHttpServer())
        .get("/clinics")
        .set("Cookie", beta.cookie)
        .expect(200);

      const alphaList = await request(app.getHttpServer())
        .get("/clinics")
        .set("Cookie", alpha.cookie)
        .expect(200);
      expect((alphaList.body as Array<{ id: string }>).map((clinic) => clinic.id)).not.toContain(
        beta.clinicId,
      );

      await request(app.getHttpServer())
        .patch(`/clinics/${beta.clinicId}`)
        .set("Cookie", alpha.cookie)
        .send({ name: "Not Beta's Clinic" })
        .expect(404);

      const betaAfter = await request(app.getHttpServer())
        .get("/clinics")
        .set("Cookie", beta.cookie)
        .expect(200);
      expect(betaAfter.body).toEqual(betaBefore.body);
    });

    it("cannot page through another tenant's audit trail with its event id", async () => {
      const alpha = await signupPractice(app, { organisationName: "Alpha Ledger" });
      const beta = await signupPractice(app, { organisationName: "Beta Ledger" });

      const betaAudit = await request(app.getHttpServer())
        .get("/audit?limit=50")
        .set("Cookie", beta.cookie)
        .expect(200);
      const betaEvents = (betaAudit.body as { events: Array<{ id: string }> }).events;
      const betaCursor = betaEvents[0]?.id;
      if (!betaCursor) throw new Error("Expected the beta organisation to have audit events");

      const attempt = await request(app.getHttpServer())
        .get(`/audit?limit=50&cursor=${betaCursor}`)
        .set("Cookie", alpha.cookie)
        .expect(404);
      expect(attempt.body.error.code).toBe("CURSOR_NOT_FOUND");

      const alphaAudit = await request(app.getHttpServer())
        .get("/audit?limit=50")
        .set("Cookie", alpha.cookie)
        .expect(200);
      const betaIds = new Set(betaEvents.map((event) => event.id));
      for (const event of (alphaAudit.body as { events: Array<{ id: string }> }).events) {
        expect(betaIds.has(event.id)).toBe(false);
      }
    });

    it("offers no route that amends or deletes an audit record", async () => {
      const owner = await signupPractice(app, { organisationName: "Audit Immutable" });

      const before = await request(app.getHttpServer())
        .get("/audit?limit=50")
        .set("Cookie", owner.cookie)
        .expect(200);
      const events = (before.body as { events: Array<{ id: string }> }).events;
      const eventId = events[0]?.id;
      if (!eventId) throw new Error("Expected the organisation to have audit events");

      // The trail is append-only: neither verb exists on the audit controller.
      await request(app.getHttpServer())
        .patch(`/audit/${eventId}`)
        .set("Cookie", owner.cookie)
        .send({ summary: "Rewritten history" })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/audit/${eventId}`)
        .set("Cookie", owner.cookie)
        .expect(404);

      const after = await request(app.getHttpServer())
        .get("/audit?limit=50")
        .set("Cookie", owner.cookie)
        .expect(200);
      expect((after.body as { events: unknown[] }).events).toEqual(events);
    });
  });
});
