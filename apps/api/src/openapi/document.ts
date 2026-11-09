import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";
import {
  acceptInvitationSchema,
  createClinicSchema,
  createRoleSchema,
  forgotPasswordSchema,
  inviteStaffSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  updateClinicSchema,
  updateMembershipSchema,
  updateOrganisationSchema,
  updateRoleSchema,
} from "@vetnex/shared";

/**
 * The OpenAPI description of the HTTP API.
 *
 * Request bodies are generated from the same Zod schemas the API validates with
 * (`parseInput`), so field names, required fields, formats and bounds cannot drift
 * from what the server actually accepts. Response schemas are maintained here and
 * are checked against the registered routes by `test/openapi.spec.ts`, which fails
 * if a route is undocumented or a permission is misdescribed.
 *
 * `pnpm openapi:check` fails when `docs/openapi.json` is stale.
 */

type JsonObject = Record<string, unknown>;

export const OPENAPI_VERSION = "3.0.3";
export const API_TITLE = "VETNEX API";
export const API_VERSION = "0.1.0";

/** Preview of a session cookie; the real name is configurable via SESSION_COOKIE_NAME. */
const SESSION_COOKIE_NAME = "vetnex_session";

function requestSchema(schema: z.ZodTypeAny): JsonObject {
  const generated = zodToJsonSchema(schema, {
    target: "openApi3",
    $refStrategy: "none",
    effectStrategy: "input",
  }) as JsonObject;

  // `$schema` and `definitions` are not valid inside an OpenAPI schema object.
  const {
    $schema: _schema,
    definitions: _definitions,
    ...rest
  } = generated as JsonObject & { $schema?: unknown; definitions?: unknown };
  return rest;
}

const uuid = { type: "string", format: "uuid" } as const;
const timestamp = { type: "string", format: "date-time" } as const;
const nullableString = { type: "string", nullable: true } as const;
const stringArray = { type: "array", items: { type: "string" } } as const;

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const responseRef = (name: string) => ({ $ref: `#/components/responses/${name}` });

const jsonBody = (schema: JsonObject) => ({
  required: true,
  content: { "application/json": { schema } },
});

const jsonResponse = (schema: unknown, description = "Success") => ({
  description,
  content: { "application/json": { schema } },
});

/** Session cookie for browsers, bearer token for server clients. */
const secured = [{ sessionCookie: [] }, { bearerAuth: [] }];

type Operation = {
  tags: string[];
  summary: string;
  description?: string;
  security?: unknown[];
  "x-required-permission"?: string[];
  parameters?: unknown[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
};

type RouteDescription = {
  method: "get" | "post" | "patch" | "delete" | "put";
  path: string;
  operation: Operation;
};

function route(
  method: RouteDescription["method"],
  path: string,
  operation: Operation,
): RouteDescription {
  return { method, path, operation };
}

function schemas(): JsonObject {
  return {
    SessionPayload: {
      type: "object",
      required: ["user", "organisation", "membership", "permissions", "clinics", "session"],
      properties: {
        user: {
          type: "object",
          required: ["id", "email", "fullName", "status", "mfaEnabled"],
          properties: {
            id: uuid,
            email: { type: "string", format: "email" },
            fullName: { type: "string" },
            status: { type: "string" },
            mfaEnabled: { type: "boolean" },
          },
        },
        organisation: {
          type: "object",
          required: [
            "id",
            "name",
            "slug",
            "timezone",
            "currency",
            "gstRate",
            "retentionYearsClinical",
          ],
          properties: {
            id: uuid,
            name: { type: "string" },
            slug: { type: "string" },
            timezone: { type: "string" },
            currency: { type: "string", example: "AUD" },
            gstRate: { type: "number", example: 0.1 },
            retentionYearsClinical: { type: "integer", example: 7 },
          },
        },
        membership: {
          type: "object",
          required: ["id", "title", "roleId", "roleName", "roleKey", "clinicIds"],
          properties: {
            id: uuid,
            title: nullableString,
            roleId: uuid,
            roleName: { type: "string" },
            roleKey: nullableString,
            clinicIds: { type: "array", items: uuid },
          },
        },
        permissions: { ...stringArray, description: "Effective permission codes." },
        clinics: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "name", "code"],
            properties: { id: uuid, name: { type: "string" }, code: { type: "string" } },
          },
        },
        session: {
          type: "object",
          required: ["id", "expiresAt"],
          properties: { id: uuid, expiresAt: timestamp },
        },
      },
    },
    Organisation: {
      type: "object",
      required: [
        "id",
        "name",
        "slug",
        "timezone",
        "currency",
        "locale",
        "gstRate",
        "retentionYearsClinical",
        "createdAt",
        "counts",
      ],
      properties: {
        id: uuid,
        name: { type: "string" },
        slug: { type: "string" },
        timezone: { type: "string" },
        currency: { type: "string" },
        locale: { type: "string" },
        gstRate: { type: "number" },
        retentionYearsClinical: { type: "integer" },
        createdAt: timestamp,
        counts: {
          type: "object",
          required: ["clinics", "activeStaff", "pendingInvitations"],
          properties: {
            clinics: { type: "integer" },
            activeStaff: { type: "integer" },
            pendingInvitations: { type: "integer" },
          },
        },
      },
    },
    Clinic: {
      type: "object",
      required: ["id", "name", "code", "timezone", "status", "createdAt", "departments", "staffCount"],
      properties: {
        id: uuid,
        name: { type: "string" },
        code: { type: "string", example: "RICHMOND" },
        timezone: { type: "string" },
        phone: nullableString,
        email: nullableString,
        addressLine1: nullableString,
        suburb: nullableString,
        state: nullableString,
        postcode: nullableString,
        country: { type: "string" },
        status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
        createdAt: timestamp,
        departments: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "name"],
            properties: { id: uuid, name: { type: "string" } },
          },
        },
        staffCount: { type: "integer" },
      },
    },
    StaffMember: {
      type: "object",
      required: [
        "membershipId",
        "userId",
        "fullName",
        "email",
        "accountStatus",
        "lastLoginAt",
        "title",
        "status",
        "role",
        "clinicIds",
        "createdAt",
      ],
      properties: {
        membershipId: uuid,
        userId: uuid,
        fullName: { type: "string" },
        email: { type: "string", format: "email" },
        accountStatus: { type: "string" },
        lastLoginAt: { type: "string", format: "date-time", nullable: true },
        title: nullableString,
        status: { type: "string", enum: ["ACTIVE", "SUSPENDED"] },
        role: {
          type: "object",
          required: ["id", "name", "systemKey"],
          properties: { id: uuid, name: { type: "string" }, systemKey: nullableString },
        },
        clinicIds: { type: "array", items: uuid },
        createdAt: timestamp,
      },
    },
    Invitation: {
      type: "object",
      required: ["id", "email", "fullName", "title", "roleName", "invitedBy", "expiresAt", "createdAt"],
      properties: {
        id: uuid,
        email: { type: "string", format: "email" },
        fullName: nullableString,
        title: nullableString,
        roleName: { type: "string" },
        invitedBy: { type: "string" },
        expiresAt: timestamp,
        createdAt: timestamp,
      },
    },
    CreatedInvitation: {
      type: "object",
      required: ["invitation"],
      properties: {
        invitation: {
          type: "object",
          required: ["id", "email", "roleName", "expiresAt"],
          properties: {
            id: uuid,
            email: { type: "string", format: "email" },
            roleName: { type: "string" },
            expiresAt: timestamp,
          },
        },
        devToken: {
          type: "string",
          description:
            "Development only. Present when AUTH_DEV_TOKEN_DELIVERY=true because no email provider is configured; never returned in production.",
        },
      },
    },
    PublicInvitation: {
      type: "object",
      required: [
        "organisationName",
        "email",
        "fullName",
        "title",
        "roleName",
        "clinicNames",
        "expiresAt",
        "expired",
        "accepted",
        "revoked",
      ],
      properties: {
        organisationName: { type: "string" },
        email: { type: "string", format: "email" },
        fullName: nullableString,
        title: nullableString,
        roleName: { type: "string" },
        clinicNames: { type: "array", items: { type: "string" } },
        expiresAt: timestamp,
        expired: { type: "boolean" },
        accepted: { type: "boolean" },
        revoked: { type: "boolean" },
      },
    },
    Role: {
      type: "object",
      required: [
        "id",
        "name",
        "description",
        "isSystem",
        "systemKey",
        "permissions",
        "memberCount",
        "createdAt",
      ],
      properties: {
        id: uuid,
        name: { type: "string" },
        description: nullableString,
        isSystem: { type: "boolean" },
        systemKey: nullableString,
        permissions: { ...stringArray, description: "Active permission codes granted by the role." },
        memberCount: { type: "integer" },
        createdAt: timestamp,
      },
    },
    AuditEvent: {
      type: "object",
      required: [
        "id",
        "action",
        "entityType",
        "entityId",
        "summary",
        "actorLabel",
        "actorUserId",
        "clinicId",
        "metadata",
        "ipAddress",
        "requestId",
        "createdAt",
      ],
      properties: {
        id: uuid,
        action: { type: "string", example: "staff.updated" },
        entityType: { type: "string" },
        entityId: nullableString,
        summary: { type: "string" },
        actorLabel: { type: "string" },
        actorUserId: nullableString,
        clinicId: nullableString,
        metadata: { type: "object", nullable: true, additionalProperties: true },
        ipAddress: nullableString,
        requestId: nullableString,
        createdAt: timestamp,
      },
    },
    AuditPage: {
      type: "object",
      required: ["events", "nextCursor"],
      properties: {
        events: { type: "array", items: ref("AuditEvent") },
        nextCursor: {
          type: "string",
          format: "uuid",
          nullable: true,
          description: "Pass as `cursor` to read the next page. Null on the last page.",
        },
      },
    },
    Dashboard: {
      type: "object",
      required: ["organisation", "metrics", "clinics", "setup", "recentActivity", "scope"],
      properties: {
        organisation: {
          type: "object",
          required: ["name", "timezone", "currency", "gstRate"],
          properties: {
            name: { type: "string" },
            timezone: { type: "string" },
            currency: { type: "string" },
            gstRate: { type: "number" },
          },
        },
        metrics: {
          type: "object",
          required: [
            "clinics",
            "activeClinics",
            "activeStaff",
            "suspendedStaff",
            "pendingInvitations",
            "roleCount",
          ],
          properties: {
            clinics: { type: "integer" },
            activeClinics: { type: "integer" },
            activeStaff: { type: "integer" },
            suspendedStaff: { type: "integer" },
            pendingInvitations: { type: "integer" },
            roleCount: { type: "integer" },
          },
        },
        clinics: {
          type: "array",
          items: {
            type: "object",
            required: [
              "id",
              "name",
              "code",
              "status",
              "suburb",
              "state",
              "staffCount",
              "departmentCount",
            ],
            properties: {
              id: uuid,
              name: { type: "string" },
              code: { type: "string" },
              status: { type: "string" },
              suburb: nullableString,
              state: nullableString,
              staffCount: { type: "integer" },
              departmentCount: { type: "integer" },
            },
          },
        },
        setup: {
          type: "array",
          items: {
            type: "object",
            required: ["key", "label", "description", "complete", "href"],
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              description: { type: "string" },
              complete: { type: "boolean" },
              href: { type: "string" },
            },
          },
        },
        recentActivity: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "action", "summary", "actorLabel", "createdAt"],
            properties: {
              id: uuid,
              action: { type: "string" },
              summary: { type: "string" },
              actorLabel: { type: "string" },
              createdAt: timestamp,
            },
          },
        },
        scope: {
          type: "object",
          required: ["roleName", "clinicIds"],
          properties: { roleName: { type: "string" }, clinicIds: { type: "array", items: uuid } },
        },
      },
    },
    SessionSummary: {
      type: "object",
      required: [
        "id",
        "current",
        "organisationName",
        "ipAddress",
        "userAgent",
        "createdAt",
        "lastSeenAt",
        "expiresAt",
      ],
      properties: {
        id: uuid,
        current: { type: "boolean" },
        organisationName: { type: "string" },
        ipAddress: nullableString,
        userAgent: nullableString,
        createdAt: timestamp,
        lastSeenAt: timestamp,
        expiresAt: timestamp,
      },
    },
    Ok: {
      type: "object",
      required: ["ok"],
      properties: { ok: { type: "boolean", enum: [true] } },
    },
    PasswordResetAccepted: {
      type: "object",
      required: ["ok"],
      properties: {
        ok: { type: "boolean", enum: [true] },
        devToken: {
          type: "string",
          description:
            "Development only. Present when AUTH_DEV_TOKEN_DELIVERY=true because no email provider is configured; never returned in production.",
        },
      },
    },
    Health: {
      type: "object",
      required: ["status", "database", "service", "time"],
      properties: {
        status: { type: "string", enum: ["ok"] },
        database: { type: "string", enum: ["ok"] },
        service: { type: "string", enum: ["vetnex-api"] },
        time: timestamp,
      },
    },
    ErrorEnvelope: {
      type: "object",
      required: ["error"],
      properties: {
        error: {
          type: "object",
          required: ["code", "message"],
          properties: {
            code: { type: "string", example: "VALIDATION_FAILED" },
            message: { type: "string" },
            fieldErrors: {
              type: "object",
              additionalProperties: { type: "array", items: { type: "string" } },
            },
            practices: {
              type: "array",
              description: "Present on ORGANISATION_SELECTION_REQUIRED.",
              items: {
                type: "object",
                required: ["id", "name"],
                properties: { id: uuid, name: { type: "string" } },
              },
            },
          },
        },
      },
    },
  };
}

function responses(): JsonObject {
  return {
    ValidationFailed: {
      description: "The request body or query did not validate.",
      content: { "application/json": { schema: ref("ErrorEnvelope") } },
    },
    Unauthenticated: {
      description: "No valid session cookie or bearer token.",
      content: { "application/json": { schema: ref("ErrorEnvelope") } },
    },
    Forbidden: {
      description: "The caller lacks the required permission, or the origin is untrusted.",
      content: { "application/json": { schema: ref("ErrorEnvelope") } },
    },
    NotFound: {
      description: "The resource does not exist in the caller's organisation.",
      content: { "application/json": { schema: ref("ErrorEnvelope") } },
    },
    Conflict: {
      description: "The request conflicts with existing state.",
      content: { "application/json": { schema: ref("ErrorEnvelope") } },
    },
    RateLimited: {
      description: "Too many attempts; retry later.",
      content: { "application/json": { schema: ref("ErrorEnvelope") } },
    },
  };
}

function paths(): Record<string, Record<string, Operation>> {
  const routes: RouteDescription[] = [
    route("get", "/health", {
      tags: ["Health"],
      summary: "Liveness and database connectivity",
      security: [],
      responses: {
        "200": jsonResponse(ref("Health"), "The API and its database are reachable."),
        "503": {
          description: "DATABASE_UNAVAILABLE",
          content: { "application/json": { schema: ref("ErrorEnvelope") } },
        },
      },
    }),

    route("post", "/auth/signup", {
      tags: ["Authentication"],
      summary: "Create a practice, its first clinic and the owner account",
      description:
        "Creates the organisation, first clinic, departments, the five system roles and a session. Validates with `signupSchema`.",
      security: [],
      requestBody: jsonBody(requestSchema(signupSchema)),
      responses: {
        "201": jsonResponse(ref("SessionPayload"), "Practice created; session cookie set."),
        "400": responseRef("ValidationFailed"),
        "409": responseRef("Conflict"),
      },
    }),

    route("post", "/auth/login", {
      tags: ["Authentication"],
      summary: "Sign in with email and password",
      description:
        "Returns `409 ORGANISATION_SELECTION_REQUIRED` with `practices[]` when the account belongs to more than one practice and `organisationId` was not supplied. Unknown emails, wrong passwords and disabled accounts are indistinguishable.",
      security: [],
      requestBody: jsonBody(requestSchema(loginSchema)),
      responses: {
        "200": jsonResponse(ref("SessionPayload"), "Signed in; session cookie set."),
        "400": responseRef("ValidationFailed"),
        "401": {
          description: "INVALID_CREDENTIALS",
          content: { "application/json": { schema: ref("ErrorEnvelope") } },
        },
        "409": {
          description: "ORGANISATION_SELECTION_REQUIRED",
          content: { "application/json": { schema: ref("ErrorEnvelope") } },
        },
        "423": {
          description: "ACCOUNT_LOCKED",
          content: { "application/json": { schema: ref("ErrorEnvelope") } },
        },
        "429": responseRef("RateLimited"),
      },
    }),

    route("get", "/auth/session", {
      tags: ["Authentication"],
      summary: "Read the current session",
      description: "Returns the `SessionPayload`, or the literal JSON value `null` when signed out.",
      security: [{}, { sessionCookie: [] }, { bearerAuth: [] }],
      responses: {
        "200": {
          description: "The current session, or null.",
          content: {
            "application/json": {
              schema: { ...ref("SessionPayload"), nullable: true },
            },
          },
        },
      },
    }),

    route("post", "/auth/logout", {
      tags: ["Authentication"],
      summary: "End the current session",
      security: [],
      responses: {
        "200": jsonResponse(ref("Ok"), "Session revoked and cookie cleared."),
      },
    }),

    route("get", "/auth/sessions", {
      tags: ["Authentication"],
      summary: "List the caller's active sessions",
      security: secured,
      "x-required-permission": [],
      responses: {
        "200": jsonResponse({ type: "array", items: ref("SessionSummary") }),
        "401": responseRef("Unauthenticated"),
      },
    }),

    route("delete", "/auth/sessions/{id}", {
      tags: ["Authentication"],
      summary: "Revoke one of the caller's sessions",
      security: secured,
      "x-required-permission": [],
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      responses: {
        "200": jsonResponse(ref("Ok")),
        "401": responseRef("Unauthenticated"),
        "404": responseRef("NotFound"),
      },
    }),

    route("post", "/auth/password/forgot", {
      tags: ["Authentication"],
      summary: "Request a password reset token",
      description:
        "Always reports success so the endpoint cannot be used to discover which emails exist. In development the token is returned as `devToken` because no email provider is configured.",
      security: [],
      requestBody: jsonBody(requestSchema(forgotPasswordSchema)),
      responses: {
        "202": jsonResponse(ref("PasswordResetAccepted"), "Request accepted."),
        "400": responseRef("ValidationFailed"),
        "429": responseRef("RateLimited"),
      },
    }),

    route("post", "/auth/password/reset", {
      tags: ["Authentication"],
      summary: "Reset a password with a token",
      description: "Revokes every existing session for the account.",
      security: [],
      requestBody: jsonBody(requestSchema(resetPasswordSchema)),
      responses: {
        "200": jsonResponse(ref("Ok")),
        "400": {
          description: "VALIDATION_FAILED or an unusable token",
          content: { "application/json": { schema: ref("ErrorEnvelope") } },
        },
      },
    }),

    route("get", "/auth/invitation/{token}", {
      tags: ["Authentication"],
      summary: "Preview an invitation",
      security: [],
      parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": jsonResponse(ref("PublicInvitation")),
        "404": responseRef("NotFound"),
      },
    }),

    route("post", "/auth/invitation/{token}/accept", {
      tags: ["Authentication"],
      summary: "Accept an invitation and start a session",
      security: [],
      parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
      requestBody: jsonBody(requestSchema(acceptInvitationSchema)),
      responses: {
        "200": jsonResponse(ref("SessionPayload"), "Invitation accepted; session cookie set."),
        "400": responseRef("ValidationFailed"),
        "409": responseRef("Conflict"),
      },
    }),

    route("get", "/organisation", {
      tags: ["Organisation"],
      summary: "Read the caller's organisation and counts",
      security: secured,
      "x-required-permission": ["organisation:read"],
      responses: {
        "200": jsonResponse(ref("Organisation")),
        "401": responseRef("Unauthenticated"),
        "403": responseRef("Forbidden"),
      },
    }),

    route("patch", "/organisation", {
      tags: ["Organisation"],
      summary: "Update organisation settings",
      security: secured,
      "x-required-permission": ["organisation:manage"],
      requestBody: jsonBody(requestSchema(updateOrganisationSchema)),
      responses: {
        "200": jsonResponse(ref("Organisation")),
        "400": responseRef("ValidationFailed"),
        "401": responseRef("Unauthenticated"),
        "403": responseRef("Forbidden"),
      },
    }),

    route("get", "/clinics", {
      tags: ["Clinics"],
      summary: "List clinics in the caller's organisation",
      security: secured,
      "x-required-permission": ["clinic:read"],
      responses: {
        "200": jsonResponse({ type: "array", items: ref("Clinic") }),
        "401": responseRef("Unauthenticated"),
        "403": responseRef("Forbidden"),
      },
    }),

    route("post", "/clinics", {
      tags: ["Clinics"],
      summary: "Create a clinic",
      security: secured,
      "x-required-permission": ["clinic:manage"],
      requestBody: jsonBody(requestSchema(createClinicSchema)),
      responses: {
        "201": jsonResponse(ref("Clinic"), "Clinic created."),
        "400": responseRef("ValidationFailed"),
        "401": responseRef("Unauthenticated"),
        "403": responseRef("Forbidden"),
        "409": responseRef("Conflict"),
      },
    }),

    route("patch", "/clinics/{id}", {
      tags: ["Clinics"],
      summary: "Update a clinic",
      security: secured,
      "x-required-permission": ["clinic:manage"],
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      requestBody: jsonBody(requestSchema(updateClinicSchema)),
      responses: {
        "200": jsonResponse(ref("Clinic")),
        "400": responseRef("ValidationFailed"),
        "401": responseRef("Unauthenticated"),
        "403": responseRef("Forbidden"),
        "404": responseRef("NotFound"),
        "409": responseRef("Conflict"),
      },
    }),

    route("get", "/staff", {
      tags: ["Staff"],
      summary: "List staff memberships",
      security: secured,
      "x-required-permission": ["staff:read"],
      responses: {
        "200": jsonResponse({ type: "array", items: ref("StaffMember") }),
        "401": responseRef("Unauthenticated"),
        "403": responseRef("Forbidden"),
      },
    }),

    route("get", "/staff/invitations", {
      tags: ["Staff"],
      summary: "List pending invitations",
      security: secured,
      "x-required-permission": ["staff:read"],
      responses: {
        "200": jsonResponse({ type: "array", items: ref("Invitation") }),
        "401": responseRef("Unauthenticated"),
        "403": responseRef("Forbidden"),
      },
    }),

    route("post", "/staff/invitations", {
      tags: ["Staff"],
      summary: "Invite a team member",
      security: secured,
      "x-required-permission": ["staff:invite"],
      requestBody: jsonBody(requestSchema(inviteStaffSchema)),
      responses: {
        "201": jsonResponse(ref("CreatedInvitation"), "Invitation created."),
        "400": responseRef("ValidationFailed"),
        "401": responseRef("Unauthenticated"),
        "403": responseRef("Forbidden"),
        "409": responseRef("Conflict"),
      },
    }),

    route("post", "/staff/invitations/{id}/revoke", {
      tags: ["Staff"],
      summary: "Revoke a pending invitation",
      security: secured,
      "x-required-permission": ["staff:invite"],
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      responses: {
        "200": jsonResponse(ref("Ok")),
        "401": responseRef("Unauthenticated"),
        "403": responseRef("Forbidden"),
        "404": responseRef("NotFound"),
      },
    }),

    route("patch", "/staff/{membershipId}", {
      tags: ["Staff"],
      summary: "Change a staff member's role, status or clinics",
      security: secured,
      "x-required-permission": ["staff:manage"],
      parameters: [{ name: "membershipId", in: "path", required: true, schema: uuid }],
      requestBody: jsonBody(requestSchema(updateMembershipSchema)),
      responses: {
        "200": jsonResponse({ ...ref("StaffMember"), nullable: true }),
        "400": responseRef("ValidationFailed"),
        "401": responseRef("Unauthenticated"),
        "403": responseRef("Forbidden"),
        "404": responseRef("NotFound"),
      },
    }),

    route("get", "/roles", {
      tags: ["Roles"],
      summary: "List roles and their permissions",
      security: secured,
      "x-required-permission": ["role:read"],
      responses: {
        "200": jsonResponse({ type: "array", items: ref("Role") }),
        "401": responseRef("Unauthenticated"),
        "403": responseRef("Forbidden"),
      },
    }),

    route("post", "/roles", {
      tags: ["Roles"],
      summary: "Create a custom role",
      description:
        "Rejects permission codes whose catalogue entry is still `planned` with `400 INVALID_PERMISSION`.",
      security: secured,
      "x-required-permission": ["role:manage"],
      requestBody: jsonBody(requestSchema(createRoleSchema)),
      responses: {
        "201": jsonResponse(ref("Role"), "Role created."),
        "400": responseRef("ValidationFailed"),
        "401": responseRef("Unauthenticated"),
        "403": responseRef("Forbidden"),
        "409": responseRef("Conflict"),
      },
    }),

    route("patch", "/roles/{id}", {
      tags: ["Roles"],
      summary: "Update a role",
      description: "The Owner role is protected: `403 ROLE_PROTECTED`.",
      security: secured,
      "x-required-permission": ["role:manage"],
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      requestBody: jsonBody(requestSchema(updateRoleSchema)),
      responses: {
        "200": jsonResponse(ref("Role")),
        "400": responseRef("ValidationFailed"),
        "401": responseRef("Unauthenticated"),
        "403": responseRef("Forbidden"),
        "404": responseRef("NotFound"),
        "409": responseRef("Conflict"),
      },
    }),

    route("delete", "/roles/{id}", {
      tags: ["Roles"],
      summary: "Delete a custom role",
      description: "Default roles and roles still assigned to staff cannot be deleted.",
      security: secured,
      "x-required-permission": ["role:manage"],
      parameters: [{ name: "id", in: "path", required: true, schema: uuid }],
      responses: {
        "200": jsonResponse(ref("Ok")),
        "401": responseRef("Unauthenticated"),
        "403": responseRef("Forbidden"),
        "404": responseRef("NotFound"),
        "409": responseRef("Conflict"),
      },
    }),

    route("get", "/audit", {
      tags: ["Audit"],
      summary: "Page through the append-only audit trail",
      description:
        "Newest first. The trail can only be read: there is no update or delete route anywhere in the API.",
      security: secured,
      "x-required-permission": ["audit:read"],
      parameters: [
        {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
        },
        {
          name: "cursor",
          in: "query",
          required: false,
          description: "`nextCursor` from the previous page.",
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": jsonResponse(ref("AuditPage")),
        "400": responseRef("ValidationFailed"),
        "401": responseRef("Unauthenticated"),
        "403": responseRef("Forbidden"),
        "404": {
          description: "CURSOR_NOT_FOUND",
          content: { "application/json": { schema: ref("ErrorEnvelope") } },
        },
      },
    }),

    route("get", "/dashboard", {
      tags: ["Dashboard"],
      summary: "Read the practice dashboard",
      description: "Authenticated without a specific permission. Contains only real Phase 1 data.",
      security: secured,
      "x-required-permission": [],
      responses: {
        "200": jsonResponse(ref("Dashboard")),
        "401": responseRef("Unauthenticated"),
      },
    }),

    route("get", "/openapi.json", {
      tags: ["Documentation"],
      summary: "This document",
      security: [],
      responses: {
        "200": {
          description: "The OpenAPI document for this API.",
          content: { "application/json": { schema: { type: "object", additionalProperties: true } } },
        },
      },
    }),
  ];

  const result: Record<string, Record<string, Operation>> = {};
  for (const entry of routes) {
    result[entry.path] = { ...(result[entry.path] ?? {}), [entry.method]: entry.operation };
  }

  // Keep the document deterministic: sort paths and verbs alphabetically.
  const sorted: Record<string, Record<string, Operation>> = {};
  for (const path of Object.keys(result).sort()) {
    const verbs = result[path] ?? {};
    const ordered: Record<string, Operation> = {};
    for (const method of Object.keys(verbs).sort()) {
      const operation = verbs[method];
      if (operation) ordered[method] = operation;
    }
    sorted[path] = ordered;
  }
  return sorted;
}

export function buildOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: OPENAPI_VERSION,
    info: {
      title: API_TITLE,
      version: API_VERSION,
      description: [
        "VETNEX veterinary practice management API.",
        "",
        "Every tenant-owned query is scoped to the organisation resolved from the session; no",
        "endpoint accepts an organisation id from the caller. Request bodies are generated from",
        "the Zod contracts in `packages/shared`, which the server validates with.",
        "",
        "Errors always use the `ErrorEnvelope` shape. Authentication is a session cookie for",
        "browsers or a bearer token for server clients.",
      ].join("\n"),
      license: { name: "Proprietary" },
    },
    servers: [
      { url: "http://localhost:4000", description: "Local development" },
      { url: "/api", description: "Same-origin proxy exposed by the web app" },
    ],
    tags: [
      { name: "Health", description: "Liveness and readiness." },
      { name: "Authentication", description: "Signup, sign-in, sessions, password reset, invitations." },
      { name: "Organisation", description: "Practice settings and counts." },
      { name: "Clinics", description: "Clinic records." },
      { name: "Staff", description: "Memberships and invitations." },
      { name: "Roles", description: "Roles and permission grants." },
      { name: "Audit", description: "Append-only audit trail." },
      { name: "Dashboard", description: "Practice overview." },
      { name: "Documentation", description: "This specification." },
    ],
    paths: paths(),
    components: {
      securitySchemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: SESSION_COOKIE_NAME,
          description:
            "HttpOnly session cookie set by sign-in. The name is configurable via SESSION_COOKIE_NAME.",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Session token for server-to-server clients.",
        },
      },
      schemas: schemas(),
      responses: responses(),
    },
  };
}
