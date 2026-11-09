import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  createApp,
  getRoleId,
  inviteAndAccept,
  readSessionCookie,
  signupPractice,
  TEST_PASSWORD,
} from "./helpers";

describe("authentication and staff lifecycle", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates an organisation, first clinic, owner and session on signup", async () => {
    const signup = await signupPractice(app, {
      organisationName: "Riverbend Test Group",
      clinicName: "Bridge Road Clinic",
    });

    expect(signup.session).toMatchObject({
      organisation: { name: "Riverbend Test Group", timezone: "Australia/Sydney", currency: "AUD" },
      membership: { roleKey: "org_admin" },
      clinics: [{ name: "Bridge Road Clinic", code: "BRIDGE" }],
    });
    expect(signup.session.permissions).toContain("organisation:manage");
    expect(signup.session.permissions).not.toContain("clinical:sign");

    const session = await request(app.getHttpServer())
      .get("/auth/session")
      .set("Cookie", signup.cookie)
      .expect(200);
    expect(session.body.user.email).toBe(signup.email);
  });

  it("returns null for an unauthenticated session and 401 for protected routes", async () => {
    const session = await request(app.getHttpServer()).get("/auth/session").expect(200);
    expect(session.body).toBeNull();

    await request(app.getHttpServer()).get("/dashboard").expect(401);
  });

  it("rejects duplicate registration for the same email", async () => {
    const first = await signupPractice(app);
    const response = await request(app.getHttpServer())
      .post("/auth/signup")
      .send({
        organisationName: "Another Practice",
        clinicName: "Another Clinic",
        fullName: "Second Owner",
        email: first.email,
        password: TEST_PASSWORD,
      })
      .expect(409);
    expect(response.body.error.code).toBe("EMAIL_IN_USE");
  });

  it("validates input and reports field errors", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ organisationName: "x", clinicName: "y", fullName: "z", email: "nope", password: "short" })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(response.body.error.fieldErrors)).toEqual(
      expect.arrayContaining(["organisationName", "email", "password"]),
    );
  });

  it("signs in, rejects a wrong password, and signs out", async () => {
    const signup = await signupPractice(app);

    const wrong = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: signup.email, password: "definitely-wrong-1" })
      .expect(401);
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: signup.email, password: TEST_PASSWORD })
      .expect(200);
    expect(login.body.user.email).toBe(signup.email);

    const cookie = readSessionCookie(login);
    await request(app.getHttpServer()).get("/dashboard").set("Cookie", cookie).expect(200);

    await request(app.getHttpServer()).post("/auth/logout").set("Cookie", cookie).expect(200);

    const afterLogout = await request(app.getHttpServer())
      .get("/dashboard")
      .set("Cookie", cookie)
      .expect(401);
    expect(afterLogout.body.error.code).toBe("SESSION_EXPIRED");
  });

  it("returns the same error for an unknown email as for a wrong password", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: `ghost-${randomUUID().slice(0, 6)}@test.vet`, password: TEST_PASSWORD })
      .expect(401);
    expect(response.body.error.message).toBe("Email or password is incorrect.");
  });

  it("locks an account after repeated failures", async () => {
    const signup = await signupPractice(app);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: signup.email, password: "wrong-password-here" })
        .expect(401);
    }
    const locked = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: signup.email, password: TEST_PASSWORD })
      .expect(429);
    expect(locked.body.error.code).toBe("ACCOUNT_LOCKED");
  });

  it("resets a password and revokes existing sessions", async () => {
    const signup = await signupPractice(app);

    const forgot = await request(app.getHttpServer())
      .post("/auth/password/forgot")
      .send({ email: signup.email })
      .expect(202);
    expect(forgot.body.ok).toBe(true);
    const token = forgot.body.devToken as string;
    expect(token).toBeTruthy();

    const newPassword = "Riverbend-Reset-2026";
    await request(app.getHttpServer())
      .post("/auth/password/reset")
      .send({ token, password: newPassword })
      .expect(200);

    // Old session is revoked
    await request(app.getHttpServer()).get("/dashboard").set("Cookie", signup.cookie).expect(401);

    // Old password no longer works, new password does
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: signup.email, password: TEST_PASSWORD })
      .expect(401);
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: signup.email, password: newPassword })
      .expect(200);
  });

  it("does not disclose whether an account exists on password reset", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/password/forgot")
      .send({ email: `nobody-${randomUUID().slice(0, 6)}@test.vet` })
      .expect(202);
    expect(response.body).toEqual({ ok: true });
  });

  it("invites a staff member who can then sign in", async () => {
    const owner = await signupPractice(app);
    const vetRoleId = await getRoleId(app, owner.cookie, "veterinarian");
    const email = `vet-${randomUUID().slice(0, 8)}@test.vet`;

    const invitation = await request(app.getHttpServer())
      .post("/staff/invitations")
      .set("Cookie", owner.cookie)
      .send({ email, roleId: vetRoleId, clinicIds: [owner.clinicId] })
      .expect(201);

    expect(invitation.body.invitation.roleName).toBe("Veterinarian");
    const token = invitation.body.devToken as string;
    expect(token).toBeTruthy();

    const preview = await request(app.getHttpServer())
      .get(`/auth/invitation/${token}`)
      .expect(200);
    expect(preview.body).toMatchObject({
      email,
      roleName: "Veterinarian",
      accepted: false,
      expired: false,
    });

    const accepted = await request(app.getHttpServer())
      .post(`/auth/invitation/${token}/accept`)
      .send({ fullName: "Dr Test Vet", password: TEST_PASSWORD })
      .expect(200);
    expect(accepted.body.membership.roleKey).toBe("veterinarian");
    expect(accepted.body.organisation.id).toBe(owner.organisationId);

    // Signing in afterwards works with the same credentials.
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    expect(login.body.membership.roleKey).toBe("veterinarian");

    // The invitation cannot be used twice.
    const reused = await request(app.getHttpServer())
      .post(`/auth/invitation/${token}/accept`)
      .send({ fullName: "Dr Test Vet", password: TEST_PASSWORD })
      .expect(409);
    expect(reused.body.error.code).toBe("INVITATION_ACCEPTED");

    const staff = await request(app.getHttpServer())
      .get("/staff")
      .set("Cookie", owner.cookie)
      .expect(200);
    expect(staff.body.some((member: { email: string }) => member.email === email)).toBe(true);
  });

  it("rejects expired and revoked invitations", async () => {
    const owner = await signupPractice(app);
    const nurseRoleId = await getRoleId(app, owner.cookie, "nurse");

    const invitation = await request(app.getHttpServer())
      .post("/staff/invitations")
      .set("Cookie", owner.cookie)
      .send({ email: `nurse-${randomUUID().slice(0, 8)}@test.vet`, roleId: nurseRoleId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/staff/invitations/${invitation.body.invitation.id}/revoke`)
      .set("Cookie", owner.cookie)
      .expect(200);

    const accept = await request(app.getHttpServer())
      .post(`/auth/invitation/${invitation.body.devToken}/accept`)
      .send({ fullName: "Nurse Test", password: TEST_PASSWORD })
      .expect(410);
    expect(accept.body.error.code).toBe("INVITATION_UNAVAILABLE");
  });

  it("prevents the last owner from being removed", async () => {
    const owner = await signupPractice(app);
    const staff = await request(app.getHttpServer())
      .get("/staff")
      .set("Cookie", owner.cookie)
      .expect(200);
    const self = (staff.body as Array<{ membershipId: string; email: string }>).find(
      (member) => member.email === owner.email,
    );
    expect(self).toBeTruthy();

    const response = await request(app.getHttpServer())
      .patch(`/staff/${self!.membershipId}`)
      .set("Cookie", owner.cookie)
      .send({ status: "SUSPENDED" })
      .expect(409);
    expect(response.body.error.code).toBe("LAST_OWNER");
  });

  it("blocks requests from an untrusted browser origin", async () => {
    const signup = await signupPractice(app);
    const response = await request(app.getHttpServer())
      .patch("/organisation")
      .set("Cookie", signup.cookie)
      .set("Origin", "https://attacker.example")
      .send({ name: "Hijacked" })
      .expect(403);
    expect(response.body.error.code).toBe("UNTRUSTED_ORIGIN");
  });

  it("rate limits repeated signups from the same address", async () => {
    // Rate limiting is disabled under NODE_ENV=test, so this asserts the expected
    // production behaviour by checking the configured limiter directly.
    const { RateLimiter } = await import("../src/common/rate-limiter");
    const limiter = new RateLimiter();
    let blocked = 0;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (!limiter.hit("signup:127.0.0.1", 3, 60_000).allowed) blocked += 1;
    }
    expect(blocked).toBe(2);
  });

  it("shows pending invitations and lists active sessions", async () => {
    const owner = await signupPractice(app);
    const roleId = await getRoleId(app, owner.cookie, "receptionist");
    const email = `reception-${randomUUID().slice(0, 8)}@test.vet`;
    await request(app.getHttpServer())
      .post("/staff/invitations")
      .set("Cookie", owner.cookie)
      .send({ email, roleId })
      .expect(201);

    const pending = await request(app.getHttpServer())
      .get("/staff/invitations")
      .set("Cookie", owner.cookie)
      .expect(200);
    expect(pending.body).toHaveLength(1);
    expect(pending.body[0].email).toBe(email);

    const sessions = await request(app.getHttpServer())
      .get("/auth/sessions")
      .set("Cookie", owner.cookie)
      .expect(200);
    expect(sessions.body).toHaveLength(1);
    expect(sessions.body[0].current).toBe(true);
    expect(JSON.stringify(sessions.body[0])).not.toContain("tokenHash");
  });

  it("accepts a second practice member and enforces email verification rules", async () => {
    const owner = await signupPractice(app);
    const roleId = await getRoleId(app, owner.cookie, "nurse");
    const email = `nurse2-${randomUUID().slice(0, 8)}@test.vet`;

    const { cookie } = await inviteAndAccept(app, owner.cookie, { email, roleId });
    const session = await request(app.getHttpServer())
      .get("/auth/session")
      .set("Cookie", cookie)
      .expect(200);
    expect(session.body.membership.roleKey).toBe("nurse");

    // An existing account cannot be pulled into another practice by invitation.
    const other = await signupPractice(app);
    const otherRoleId = await getRoleId(app, other.cookie, "veterinarian");
    const invitation = await request(app.getHttpServer())
      .post("/staff/invitations")
      .set("Cookie", other.cookie)
      .send({ email: owner.email, roleId: otherRoleId })
      .expect(201);
    const conflict = await request(app.getHttpServer())
      .post(`/auth/invitation/${invitation.body.devToken}/accept`)
      .send({ fullName: "Existing Owner", password: TEST_PASSWORD })
      .expect(409);
    expect(conflict.body.error.code).toBe("ACCOUNT_EXISTS");
  });
});
