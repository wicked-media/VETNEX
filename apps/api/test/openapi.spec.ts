import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import request from "supertest";
import { AuthController } from "../src/auth/auth.controller";
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from "../src/auth/decorators";
import {
  AuditController,
  ClinicsController,
  DashboardController,
  HealthController,
  OrganisationController,
  RolesController,
  StaffController,
} from "../src/controllers";
import { OpenApiController } from "../src/openapi/openapi.controller";
import { createApp } from "./helpers";

/**
 * The OpenAPI document is published (docs/openapi.json) and served. These tests keep
 * it honest: every registered route must appear, and the security and permission
 * metadata in the document must match the decorators the guards actually enforce.
 */

const CONTROLLERS = [
  HealthController,
  AuthController,
  OrganisationController,
  ClinicsController,
  StaffController,
  RolesController,
  AuditController,
  DashboardController,
  OpenApiController,
];

function hasSessionCookie(entry: unknown): boolean {
  return typeof entry === "object" && entry !== null && Object.hasOwn(entry, "sessionCookie");
}

const VERBS: Record<number, string> = {
  [RequestMethod.GET]: "get",
  [RequestMethod.POST]: "post",
  [RequestMethod.PUT]: "put",
  [RequestMethod.DELETE]: "delete",
  [RequestMethod.PATCH]: "patch",
  [RequestMethod.OPTIONS]: "options",
  [RequestMethod.HEAD]: "head",
};

interface Operation {
  security?: unknown[];
  "x-required-permission"?: string[];
  requestBody?: {
    content?: { "application/json"?: { schema?: { required?: string[]; properties?: Record<string, unknown> } } };
  };
  parameters?: Array<{ name: string; in: string; schema?: Record<string, unknown> }>;
  responses?: Record<string, unknown>;
}

interface Document {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, unknown> };
}

function pathOf(base: string, suffix: string): string {
  const joined = [base, suffix].filter(Boolean).join("/");
  const withParameters = joined.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
  const normalised = `/${withParameters}`.replace(/\/{2,}/g, "/").replace(/\/$/, "");
  return normalised.length > 0 ? normalised : "/";
}

interface RegisteredRoute {
  verb: string;
  path: string;
  handler: (...args: unknown[]) => unknown;
  controller: object;
}

function registeredRoutes(): RegisteredRoute[] {
  const routes: RegisteredRoute[] = [];

  for (const controller of CONTROLLERS) {
    const base = (Reflect.getMetadata(PATH_METADATA, controller) as string | undefined) ?? "";
    const prototype = controller.prototype as unknown as Record<string, unknown>;

    for (const name of Object.getOwnPropertyNames(prototype)) {
      if (name === "constructor") continue;
      const handler = prototype[name];
      if (typeof handler !== "function") continue;

      const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
      if (method === undefined) continue;
      const verb = VERBS[method];
      if (!verb) throw new Error(`Unsupported HTTP method on ${controller.name}.${name}`);

      const suffix = (Reflect.getMetadata(PATH_METADATA, handler) as string | undefined) ?? "";
      routes.push({
        verb,
        path: pathOf(base, suffix),
        handler: handler as (...args: unknown[]) => unknown,
        controller,
      });
    }
  }

  return routes;
}

describe("OpenAPI document", () => {
  let app: INestApplication;
  let document: Document;

  beforeAll(async () => {
    app = await createApp();
    const response = await request(app.getHttpServer()).get("/openapi.json").expect(200);
    document = response.body as Document;
  });

  afterAll(async () => {
    await app.close();
  });

  it("is served publicly as a valid OpenAPI 3 document", () => {
    expect(document.openapi).toMatch(/^3\.0\.\d+$/);
    expect(document.info).toMatchObject({ title: "VETNEX API", version: "0.1.0" });
    expect(document.components.schemas.SessionPayload).toBeDefined();
    expect(document.paths["/health"]?.get).toBeDefined();
    expect(document.paths["/openapi.json"]?.get).toBeDefined();
  });

  it("documents every route registered on the API", () => {
    const routes = registeredRoutes();
    expect(routes.length).toBeGreaterThan(20);

    const missing = routes
      .filter((route) => !document.paths[route.path]?.[route.verb])
      .map((route) => `${route.verb.toUpperCase()} ${route.path}`);

    expect(missing).toEqual([]);
  });

  it("keeps permissions and authentication in step with the decorators", () => {
    const routes = registeredRoutes();
    const mismatches: string[] = [];

    for (const route of routes) {
      const operation = document.paths[route.path]?.[route.verb];
      if (!operation) continue;

      const publicRoute =
        (Reflect.getMetadata(IS_PUBLIC_KEY, route.handler) as boolean | undefined) ??
        (Reflect.getMetadata(IS_PUBLIC_KEY, route.controller) as boolean | undefined) ??
        false;
      const permissions = (Reflect.getMetadata(PERMISSIONS_KEY, route.handler) as
        | string[]
        | undefined) ?? [];

      const documentedPermissions = operation["x-required-permission"] ?? [];
      if (documentedPermissions.join(",") !== permissions.join(",")) {
        mismatches.push(
          `${route.verb.toUpperCase()} ${route.path}: documented [${documentedPermissions.join(", ")}] vs enforced [${permissions.join(", ")}]`,
        );
      }

      const securedWithSession = (operation.security ?? []).some(hasSessionCookie);
      if (!publicRoute && !securedWithSession) {
        mismatches.push(`${route.verb.toUpperCase()} ${route.path}: authenticated route is not documented as secured`);
      }

      if (!operation.responses || Object.keys(operation.responses).length === 0) {
        mismatches.push(`${route.verb.toUpperCase()} ${route.path}: no responses documented`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("derives request bodies from the shared Zod contracts", () => {
    const signup = document.paths["/auth/signup"]?.post?.requestBody?.content?.["application/json"]?.schema;
    expect(signup?.required).toEqual(
      expect.arrayContaining(["organisationName", "clinicName", "fullName", "email", "password"]),
    );
    expect(signup?.properties?.email).toMatchObject({ type: "string", format: "email" });

    const login = document.paths["/auth/login"]?.post?.requestBody?.content?.["application/json"]?.schema;
    expect(login?.required).toEqual(expect.arrayContaining(["email", "password"]));
    expect(login?.required).not.toContain("organisationId");

    const invite = document.paths["/staff/invitations"]?.post?.requestBody?.content?.["application/json"]?.schema;
    expect(invite?.required).toEqual(expect.arrayContaining(["email", "roleId"]));

    const limit = document.paths["/audit"]?.get?.parameters?.find((parameter) => parameter.name === "limit");
    expect(limit?.schema).toMatchObject({ type: "integer", minimum: 1, maximum: 100, default: 25 });
  });
});
