export interface NavItem {
  href: string;
  label: string;
  description: string;
  permission?: string;
  icon: "dashboard" | "staff" | "clinics" | "roles" | "audit" | "settings";
  group: "Practice" | "Administration";
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Practice overview and setup",
    icon: "dashboard",
    group: "Practice",
  },
  {
    href: "/staff",
    label: "Team",
    description: "Staff, invitations and access",
    permission: "staff:read",
    icon: "staff",
    group: "Practice",
  },
  {
    href: "/clinics",
    label: "Clinics",
    description: "Locations, departments and contacts",
    permission: "clinic:read",
    icon: "clinics",
    group: "Practice",
  },
  {
    href: "/roles",
    label: "Roles",
    description: "Permissions and responsibility",
    permission: "role:read",
    icon: "roles",
    group: "Administration",
  },
  {
    href: "/audit",
    label: "Audit trail",
    description: "Every security and record event",
    permission: "audit:read",
    icon: "audit",
    group: "Administration",
  },
  {
    href: "/settings/organisation",
    label: "Organisation",
    description: "Regional settings and retention",
    permission: "organisation:read",
    icon: "settings",
    group: "Administration",
  },
];

export function visibleNavItems(permissions: readonly string[]): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.permission || hasPermission(permissions, item.permission));
}

/** Mirrors the API's permission matcher for UI affordances only. */
function hasPermission(granted: readonly string[], required: string): boolean {
  for (const permission of granted) {
    if (permission === required || permission === "*") return true;
    if (permission.endsWith(":*") && required.startsWith(permission.slice(0, -1))) return true;
  }
  return false;
}

export function can(permissions: readonly string[], required: string): boolean {
  return hasPermission(permissions, required);
}
