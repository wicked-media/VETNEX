import { ACTIVE_PERMISSION_CODES, type PermissionCode } from "./catalogue";

export interface SystemRoleDefinition {
  /** Stable key used in seeds, documentation and integration tests. */
  readonly key: SystemRoleKey;
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly PermissionCode[];
  /** The owner role cannot be edited, deleted or reassigned away from the last owner. */
  readonly protected: boolean;
}

export type SystemRoleKey =
  | "org_admin"
  | "practice_manager"
  | "veterinarian"
  | "nurse"
  | "receptionist"
  | "observer";

const ALL_ACTIVE = ACTIVE_PERMISSION_CODES;

/** Everything except organisation-wide destructive settings. */
const MANAGER: readonly PermissionCode[] = ALL_ACTIVE.filter(
  (code) => code !== "organisation:manage",
);

/**
 * Clinical permissions are declared now so that role intent is documented, but they
 * only take effect once the clinical modules enforce them (Phase 3). They are
 * excluded from seeding until they become `active`.
 */
export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  {
    key: "org_admin",
    name: "Owner",
    description:
      "Full control of the organisation, including billing settings, staff, roles and audit.",
    permissions: ALL_ACTIVE,
    protected: true,
  },
  {
    key: "practice_manager",
    name: "Practice Manager",
    description:
      "Runs day-to-day operations: staff, rosters, clinics, roles and reporting. Cannot change organisation-wide settings.",
    permissions: MANAGER,
    protected: false,
  },
  {
    key: "veterinarian",
    name: "Veterinarian",
    description:
      "Clinical lead on cases. Reads organisation structure and staff directory; clinical permissions activate with the clinical module.",
    permissions: ["organisation:read", "clinic:read", "staff:read", "role:read"],
    protected: false,
  },
  {
    key: "nurse",
    name: "Veterinary Nurse",
    description:
      "Supports consultations, hospital care and stock. Read-only organisation access in this release.",
    permissions: ["organisation:read", "clinic:read", "staff:read"],
    protected: false,
  },
  {
    key: "receptionist",
    name: "Receptionist",
    description: "Front desk: client and appointment coordination, plus clinic information.",
    permissions: ["organisation:read", "clinic:read", "staff:read"],
    protected: false,
  },
  {
    key: "observer",
    name: "Observer",
    description:
      "Read-only access for locums, auditors or visiting specialists. No ability to change records.",
    permissions: ["organisation:read", "clinic:read", "staff:read", "role:read", "audit:read"],
    protected: false,
  },
];

export function getSystemRole(key: string): SystemRoleDefinition | undefined {
  return SYSTEM_ROLES.find((role) => role.key === key);
}
