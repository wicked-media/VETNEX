import { describe, expect, it } from "vitest";
import { can, NAV_ITEMS, visibleNavItems } from "./navigation";

describe("navigation", () => {
  it("hides destinations the role cannot reach", () => {
    const receptionist = visibleNavItems(["organisation:read", "clinic:read", "staff:read"]);
    const hrefs = receptionist.map((item) => item.href);
    expect(hrefs).toEqual(["/dashboard", "/staff", "/clinics", "/settings/organisation"]);
    expect(hrefs).not.toContain("/roles");
    expect(hrefs).not.toContain("/audit");
  });

  it("shows administration destinations to an owner", () => {
    const owner = visibleNavItems([
      "organisation:read",
      "organisation:manage",
      "clinic:read",
      "staff:read",
      "role:read",
      "audit:read",
    ]);
    expect(owner.map((item) => item.href)).toEqual(NAV_ITEMS.map((item) => item.href));
  });

  it("supports resource wildcards consistently with the API", () => {
    expect(can(["staff:*"], "staff:manage")).toBe(true);
    expect(can(["staff:*"], "audit:read")).toBe(false);
    expect(can([], "clinic:read")).toBe(false);
  });

  it("always exposes the dashboard", () => {
    expect(visibleNavItems([]).map((item) => item.href)).toEqual(["/dashboard"]);
  });
});
