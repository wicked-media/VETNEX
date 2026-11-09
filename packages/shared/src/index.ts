export * from "./constants";
export * from "./schemas";

/** Shape of the authenticated session returned by `GET /auth/session`. */
export interface SessionPayload {
  user: {
    id: string;
    email: string;
    fullName: string;
    status: string;
    mfaEnabled: boolean;
  };
  organisation: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    currency: string;
    gstRate: number;
    retentionYearsClinical: number;
  };
  membership: {
    id: string;
    title: string | null;
    roleId: string;
    roleName: string;
    roleKey: string | null;
    clinicIds: string[];
  };
  permissions: string[];
  clinics: Array<{ id: string; name: string; code: string }>;
  session: {
    id: string;
    expiresAt: string;
  };
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    /** Present when a user belongs to more than one practice and must choose one. */
    practices?: Array<{ id: string; name: string }>;
  };
}
