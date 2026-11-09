import { describe, expect, it } from "vitest";
import {
  ACTIVE_PERMISSION_CODES,
  ALL_PERMISSION_CODES,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isPermissionCode,
  partitionPermissions,
  validateGrantablePermissions,
} from "../index";
import { SYSTEM_ROLES } from "../roles";

describe("permission catalogue", () => {
  it("has unique codes", () => {
    expect(new Set(ALL_PERMISSION_CODES).size).toBe(ALL_PERMISSION_CODES.length);
  });

  it("marks foundation permissions active and clinical permissions planned", () => {
    expect(isPermissionCode("clinic:manage")).toBe(true);
    expect(isPermissionCode("clinical:sign")).toBe(true);
    expect(ACTIVE_PERMISSION_CODES).not.toContain("clinical:sign");
    expect(ACTIVE_PERMISSION_CODES).toContain("audit:read");
  });

  it("does not accept arbitrary strings from a client", () => {
    expect(isPermissionCode("clinic:destroy")).toBe(false);
    expect(partitionPermissions(["clinic:read", "clinic:destroy"]).unknown).toEqual([
      "clinic:destroy",
    ]);
  });
});

describe("hasPermission", () => {
  it("requires an exact match by default", () => {
    expect(hasPermission(["clinic:read"], "clinic:read")).toBe(true);
    expect(hasPermission(["clinic:read"], "clinic:manage")).toBe(false);
  });

  it("supports resource and global wildcards", () => {
    expect(hasPermission(["clinic:*"], "clinic:manage")).toBe(true);
    expect(hasPermission(["clinic:*"], "organisation:manage")).toBe(false);
    expect(hasPermission(["*"], "anything:at:all")).toBe(true);
  });

  it("denies everything for an empty grant list", () => {
    expect(hasPermission([], "clinic:read")).toBe(false);
    expect(hasAnyPermission([], ["clinic:read"])).toBe(false);
    expect(hasAllPermissions([], [])).toBe(true);
  });

  it("treats a wildcard fragment as a prefix match only", () => {
    expect(hasPermission(["*"], "clinic:read")).toBe(true);
    expect(hasPermission(["clinic:*"], "clinic")).toBe(false);
  });
});

describe("validateGrantablePermissions", () => {
  it("accepts active permissions and de-duplicates", () => {
    expect(validateGrantablePermissions(["clinic:read", "clinic:read"])).toEqual(["clinic:read"]);
  });

  it("rejects planned permissions so roles cannot claim unenforced access", () => {
    expect(() => validateGrantablePermissions(["clinical:sign"])).toThrowError(/clinical:sign/);
  });

  it("rejects unknown permissions", () => {
    expect(() => validateGrantablePermissions(["made:up"])).toThrowError(/made:up/);
  });
});

describe("system roles", () => {
  it("exposes unique keys and a protected owner role", () => {
    const keys = SYSTEM_ROLES.map((role) => role.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(SYSTEM_ROLES.filter((role) => role.protected).map((role) => role.key)).toEqual([
      "org_admin",
    ]);
  });

  it("only grants permissions that exist", () => {
    for (const role of SYSTEM_ROLES) {
      for (const permission of role.permissions) {
        expect(isPermissionCode(permission)).toBe(true);
      }
    }
  });

  it("keeps clinical permissions out of every seeded role until enforced", () => {
    for (const role of SYSTEM_ROLES) {
      const clinical = role.permissions.filter((permission) => permission.startsWith("clinical:"));
      expect(clinical).toEqual([]);
    }
  });

  it("gives the owner every active permission and managers a strict subset", () => {
    expect(SYSTEM_ROLES[0]?.permissions).toEqual(ACTIVE_PERMISSION_CODES);
    const manager = SYSTEM_ROLES.find((role) => role.key === "practice_manager");
    expect(manager?.permissions).not.toContain("organisation:manage");
    expect(manager?.permissions).toContain("staff:manage");
  });
});
