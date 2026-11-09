/**
 * VETNEX permission catalogue.
 *
 * Permissions are declared in code rather than in the database so that the set is
 * reviewable, typed and version-controlled. Roles (database rows) reference these
 * codes; unknown codes are rejected on write.
 *
 * `status: "planned"` codes are visible in the UI as roadmap items but cannot be
 * granted to a role until the module that enforces them ships. This avoids the
 * common failure mode of a permission checkbox that guards nothing.
 */

export type PermissionStatus = "active" | "planned";

export type PermissionGroup =
  | "organisation"
  | "clinic"
  | "staff"
  | "roles"
  | "audit"
  | "clinical"
  | "clients"
  | "patients"
  | "schedule"
  | "billing"
  | "inventory"
  | "reports"
  | "integrations"
  | "ai";

export interface PermissionDefinition {
  readonly code: string;
  readonly group: PermissionGroup;
  readonly label: string;
  readonly description: string;
  readonly status: PermissionStatus;
}

export const PERMISSION_DEFINITIONS = [
  {
    code: "organisation:read",
    group: "organisation",
    label: "View organisation",
    description: "Read organisation profile, branding and regional settings.",
    status: "active",
  },
  {
    code: "organisation:manage",
    group: "organisation",
    label: "Manage organisation",
    description: "Change organisation settings, retention policy and tax configuration.",
    status: "active",
  },
  {
    code: "clinic:read",
    group: "clinic",
    label: "View clinics",
    description: "Read clinic locations, departments and contact details.",
    status: "active",
  },
  {
    code: "clinic:manage",
    group: "clinic",
    label: "Manage clinics",
    description: "Create and edit clinic locations and departments.",
    status: "active",
  },
  {
    code: "staff:read",
    group: "staff",
    label: "View staff",
    description: "Read the staff directory and role assignments.",
    status: "active",
  },
  {
    code: "staff:manage",
    group: "staff",
    label: "Manage staff",
    description: "Change staff roles, clinic access and account status.",
    status: "active",
  },
  {
    code: "staff:invite",
    group: "staff",
    label: "Invite staff",
    description: "Invite new team members and revoke pending invitations.",
    status: "active",
  },
  {
    code: "role:read",
    group: "roles",
    label: "View roles",
    description: "Read roles and their permission sets.",
    status: "active",
  },
  {
    code: "role:manage",
    group: "roles",
    label: "Manage roles",
    description: "Create and edit custom roles and their permissions.",
    status: "active",
  },
  {
    code: "audit:read",
    group: "audit",
    label: "View audit trail",
    description: "Read the immutable audit log for the organisation.",
    status: "active",
  },
  {
    code: "client:read",
    group: "clients",
    label: "View clients",
    description: "Read client records, contact details and communication preferences.",
    status: "planned",
  },
  {
    code: "client:write",
    group: "clients",
    label: "Manage clients",
    description: "Create and amend client records.",
    status: "planned",
  },
  {
    code: "patient:read",
    group: "patients",
    label: "View patients",
    description: "Read patient records, alerts, history and attachments.",
    status: "planned",
  },
  {
    code: "patient:write",
    group: "patients",
    label: "Manage patients",
    description: "Create and amend patient records, alerts and observations.",
    status: "planned",
  },
  {
    code: "schedule:read",
    group: "schedule",
    label: "View schedule",
    description: "Read appointments, rosters and resource allocation.",
    status: "planned",
  },
  {
    code: "schedule:manage",
    group: "schedule",
    label: "Manage schedule",
    description: "Book, move and cancel appointments.",
    status: "planned",
  },
  {
    code: "clinical:read",
    group: "clinical",
    label: "View clinical records",
    description: "Read consultations, notes and clinical history.",
    status: "planned",
  },
  {
    code: "clinical:write",
    group: "clinical",
    label: "Author clinical records",
    description: "Draft clinical notes, observations and treatment entries.",
    status: "planned",
  },
  {
    code: "clinical:sign",
    group: "clinical",
    label: "Sign clinical records",
    description: "Finalise and sign clinical records as the responsible clinician.",
    status: "planned",
  },
  {
    code: "billing:read",
    group: "billing",
    label: "View billing",
    description: "Read estimates, invoices and payments.",
    status: "planned",
  },
  {
    code: "billing:manage",
    group: "billing",
    label: "Manage billing",
    description: "Create invoices, take payments and issue credit notes.",
    status: "planned",
  },
  {
    code: "billing:refund",
    group: "billing",
    label: "Refund payments",
    description: "Refund captured payments and write off balances.",
    status: "planned",
  },
  {
    code: "inventory:read",
    group: "inventory",
    label: "View inventory",
    description: "Read stock levels, batches and purchase orders.",
    status: "planned",
  },
  {
    code: "inventory:manage",
    group: "inventory",
    label: "Manage inventory",
    description: "Receive stock, adjust counts and manage suppliers.",
    status: "planned",
  },
  {
    code: "report:read",
    group: "reports",
    label: "View reports",
    description: "Read operational and financial reporting.",
    status: "planned",
  },
  {
    code: "integration:manage",
    group: "integrations",
    label: "Manage integrations",
    description: "Connect and configure third-party providers.",
    status: "planned",
  },
  {
    code: "ai:use",
    group: "ai",
    label: "Use AI assistance",
    description: "Request AI assistance on records the user can already read.",
    status: "planned",
  },
] as const satisfies readonly PermissionDefinition[];

export type PermissionCode = (typeof PERMISSION_DEFINITIONS)[number]["code"];

const DEFINITIONS_BY_CODE = new Map<string, PermissionDefinition>(
  PERMISSION_DEFINITIONS.map((definition) => [definition.code, definition]),
);

export const ALL_PERMISSION_CODES: readonly PermissionCode[] = PERMISSION_DEFINITIONS.map(
  (definition) => definition.code,
);

/** Permissions enforced by shipped functionality in this release. */
export const ACTIVE_PERMISSION_CODES: readonly PermissionCode[] = PERMISSION_DEFINITIONS.filter(
  (definition) => definition.status === "active",
).map((definition) => definition.code);

export function isPermissionCode(value: string): value is PermissionCode {
  return DEFINITIONS_BY_CODE.has(value);
}

export function getPermissionDefinition(code: string): PermissionDefinition | undefined {
  return DEFINITIONS_BY_CODE.get(code);
}

export function partitionPermissions(codes: readonly string[]): {
  granted: readonly string[];
  unknown: readonly string[];
} {
  const granted = codes.filter((code) => DEFINITIONS_BY_CODE.has(code));
  const unknown = codes.filter((code) => !DEFINITIONS_BY_CODE.has(code));
  return { granted, unknown };
}

/**
 * Permission check supporting exact codes, resource wildcards (`clinic:*`) and the
 * global wildcard (`*`). Wildcards are only ever seeded for the organisation owner
 * role; user-authored roles store explicit codes.
 */
export function hasPermission(granted: readonly string[], required: string): boolean {
  if (granted.length === 0) return false;
  for (const permission of granted) {
    if (permission === required) return true;
    if (permission === "*") return true;
    if (permission.endsWith(":*")) {
      const prefix = permission.slice(0, permission.length - 1);
      if (required.startsWith(prefix)) return true;
    }
  }
  return false;
}

export function hasAnyPermission(granted: readonly string[], required: readonly string[]): boolean {
  return required.some((permission) => hasPermission(granted, permission));
}

export function hasAllPermissions(granted: readonly string[], required: readonly string[]): boolean {
  return required.every((permission) => hasPermission(granted, permission));
}

/** Thrown by services when a role would be granted an unknown or not-yet-shipped permission. */
export class InvalidPermissionError extends Error {
  constructor(public readonly codes: readonly string[]) {
    super(`Unknown or unavailable permission(s): ${codes.join(", ")}`);
    this.name = "InvalidPermissionError";
  }
}

/**
 * Validates a permission set for storage. Planned permissions are rejected because
 * granting them would imply access control that does not exist yet.
 */
export function validateGrantablePermissions(codes: readonly string[]): readonly PermissionCode[] {
  const invalid: string[] = [];
  const valid: string[] = [];
  for (const code of new Set(codes)) {
    const definition = DEFINITIONS_BY_CODE.get(code);
    if (!definition || definition.status !== "active") {
      invalid.push(code);
    } else {
      valid.push(code);
    }
  }
  if (invalid.length > 0) throw new InvalidPermissionError(invalid);
  return valid as readonly PermissionCode[];
}

