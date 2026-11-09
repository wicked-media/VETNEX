import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

export const SESSION_COOKIE = "vetnex_session";
export const TEST_PASSWORD = "Vetnex-Test-Password-1";

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return app;
}

export function readSessionCookie(response: request.Response): string {
  const header = response.headers["set-cookie"];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const match = cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  if (!match) throw new Error("Expected a session cookie in the response");
  return match.split(";")[0] ?? "";
}

export function sessionCookieValue(cookie: string): string {
  return cookie.slice(cookie.indexOf("=") + 1);
}

export interface SignupResult {
  cookie: string;
  email: string;
  organisationId: string;
  clinicId: string;
  userId: string;
  session: Record<string, unknown>;
}

export async function signupPractice(
  app: INestApplication,
  overrides: Partial<{
    organisationName: string;
    clinicName: string;
    fullName: string;
    email: string;
    password: string;
  }> = {},
): Promise<SignupResult> {
  const email = overrides.email ?? `owner-${randomUUID().slice(0, 8)}@test.vet`;
  const payload = {
    organisationName: overrides.organisationName ?? "Test Practice",
    clinicName: overrides.clinicName ?? "Test Clinic",
    fullName: overrides.fullName ?? "Test Owner",
    email,
    password: overrides.password ?? TEST_PASSWORD,
    timezone: "Australia/Sydney",
  };

  const response = await request(app.getHttpServer())
    .post("/auth/signup")
    .send(payload)
    .expect(201);

  const session = response.body as {
    organisation: { id: string };
    clinics: Array<{ id: string }>;
    user: { id: string };
  };

  return {
    cookie: readSessionCookie(response),
    email,
    organisationId: session.organisation.id,
    clinicId: session.clinics[0]?.id ?? "",
    userId: session.user.id,
    session: response.body as Record<string, unknown>,
  };
}

export async function getRoleId(
  app: INestApplication,
  cookie: string,
  systemKey: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .get("/roles")
    .set("Cookie", cookie)
    .expect(200);
  const role = (response.body as Array<{ id: string; systemKey: string | null }>).find(
    (entry) => entry.systemKey === systemKey,
  );
  if (!role) throw new Error(`Role ${systemKey} not found`);
  return role.id;
}

export async function inviteAndAccept(
  app: INestApplication,
  ownerCookie: string,
  options: { email: string; roleId: string; clinicIds?: string[]; fullName?: string },
): Promise<{ cookie: string; email: string }> {
  const invitation = await request(app.getHttpServer())
    .post("/staff/invitations")
    .set("Cookie", ownerCookie)
    .send({
      email: options.email,
      roleId: options.roleId,
      clinicIds: options.clinicIds ?? [],
      fullName: options.fullName ?? "Invited Staff",
    })
    .expect(201);

  const token = (invitation.body as { devToken?: string }).devToken;
  if (!token) throw new Error("Expected a development invitation token");

  const accepted = await request(app.getHttpServer())
    .post(`/auth/invitation/${token}/accept`)
    .send({ fullName: options.fullName ?? "Invited Staff", password: TEST_PASSWORD })
    .expect(200);

  return { cookie: readSessionCookie(accepted), email: options.email };
}
