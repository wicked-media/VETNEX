import type { SessionPayload } from "@vetnex/shared";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  status: string;
  mfaEnabled: boolean;
}

export interface AuthOrganisation {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  gstRate: number;
  retentionYearsClinical: number;
}

export interface AuthMembership {
  id: string;
  title: string | null;
  roleId: string;
  roleName: string;
  roleKey: string | null;
  status: string;
  permissions: string[];
}

export interface AuthClinic {
  id: string;
  name: string;
  code: string;
}

/**
 * Everything a request is allowed to see, resolved once by AuthGuard.
 * Services take `organisation.id` from here and never from the request body, which
 * is what makes tenant isolation a property of the code path rather than a
 * convention that callers must remember.
 */
export interface AuthContext {
  session: { id: string; expiresAt: Date };
  user: AuthUser;
  organisation: AuthOrganisation;
  membership: AuthMembership;
  permissions: string[];
  clinics: AuthClinic[];
  clinicIds: string[];
}

export function toSessionPayload(auth: AuthContext): SessionPayload {
  return {
    user: {
      id: auth.user.id,
      email: auth.user.email,
      fullName: auth.user.fullName,
      status: auth.user.status,
      mfaEnabled: auth.user.mfaEnabled,
    },
    organisation: {
      id: auth.organisation.id,
      name: auth.organisation.name,
      slug: auth.organisation.slug,
      timezone: auth.organisation.timezone,
      currency: auth.organisation.currency,
      gstRate: auth.organisation.gstRate,
      retentionYearsClinical: auth.organisation.retentionYearsClinical,
    },
    membership: {
      id: auth.membership.id,
      title: auth.membership.title,
      roleId: auth.membership.roleId,
      roleName: auth.membership.roleName,
      roleKey: auth.membership.roleKey,
      clinicIds: auth.clinicIds,
    },
    permissions: auth.permissions,
    clinics: auth.clinics,
    session: {
      id: auth.session.id,
      expiresAt: auth.session.expiresAt.toISOString(),
    },
  };
}
