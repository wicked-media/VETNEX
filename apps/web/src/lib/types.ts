/** Response shapes used by server components. Mirrors the API serialisers. */

export interface DashboardData {
  organisation: { name: string; timezone: string; currency: string; gstRate: number };
  metrics: {
    clinics: number;
    activeClinics: number;
    activeStaff: number;
    suspendedStaff: number;
    pendingInvitations: number;
    roleCount: number;
  };
  clinics: Array<{
    id: string;
    name: string;
    code: string;
    status: string;
    suburb: string | null;
    state: string | null;
    staffCount: number;
    departmentCount: number;
  }>;
  setup: Array<{
    key: string;
    label: string;
    description: string;
    complete: boolean;
    href: string;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    summary: string;
    actorLabel: string;
    createdAt: string;
  }>;
  scope: { roleName: string; clinicIds: string[] };
}

export interface ClinicRecord {
  id: string;
  name: string;
  code: string;
  timezone: string;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  departments: Array<{ id: string; name: string }>;
  staffCount: number;
}

export interface StaffMember {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  accountStatus: string;
  lastLoginAt: string | null;
  title: string | null;
  status: "ACTIVE" | "SUSPENDED";
  role: { id: string; name: string; systemKey: string | null };
  clinicIds: string[];
  createdAt: string;
}

export interface InvitationRecord {
  id: string;
  email: string;
  fullName: string | null;
  title: string | null;
  roleName: string;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

export interface RoleRecord {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  systemKey: string | null;
  permissions: string[];
  memberCount: number;
  createdAt: string;
}

export interface AuditEventRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  actorLabel: string;
  actorUserId: string | null;
  clinicId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface AuditPage {
  events: AuditEventRecord[];
  nextCursor: string | null;
}

export interface OrganisationDetail {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  locale: string;
  gstRate: number;
  retentionYearsClinical: number;
  createdAt: string;
  counts: { clinics: number; activeStaff: number; pendingInvitations: number };
}
