import { z } from "zod";
import {
  AU_STATE_CODES,
  DEFAULT_CLINICAL_RETENTION_YEARS,
  DEFAULT_TIMEZONE,
  TIMEZONES,
} from "./constants";

/**
 * API request contracts, shared by the NestJS API and the Next.js client.
 * Both sides validate with the same schema, so validation rules cannot drift.
 */

export const emailSchema = z
  .string({ required_error: "Email is required." })
  .trim()
  .toLowerCase()
  .min(3, "Email is required.")
  .max(254, "Email is too long.")
  .email("Enter a valid email address.");

export const passwordSchema = z
  .string({ required_error: "Password is required." })
  .min(12, "Use at least 12 characters.")
  .max(200, "Use at most 200 characters.");

export const personNameSchema = z
  .string({ required_error: "Name is required." })
  .trim()
  .min(2, "Enter a name of at least 2 characters.")
  .max(120, "Name is too long.");

export const timezoneSchema = z.enum(TIMEZONES, {
  errorMap: () => ({ message: "Choose a supported time zone." }),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

const uuidSchema = z.string().uuid("Invalid identifier.");

/** Empty strings from HTML forms are normalised to null before validation. */
const optionalUuidArray = z
  .array(uuidSchema)
  .max(50, "Too many clinics selected.")
  .optional()
  .default([]);

/* ---------------------------------------------------------------- auth ---- */

export const signupSchema = z.object({
  organisationName: z
    .string()
    .trim()
    .min(2, "Enter your practice name.")
    .max(120, "Practice name is too long."),
  clinicName: z
    .string()
    .trim()
    .min(2, "Enter your first clinic name.")
    .max(120, "Clinic name is too long."),
  fullName: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
  timezone: timezoneSchema.default(DEFAULT_TIMEZONE),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required.").max(200),
  organisationId: uuidSchema.optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Reset token is missing or invalid."),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const acceptInvitationSchema = z.object({
  fullName: personNameSchema,
  password: passwordSchema,
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

/* ------------------------------------------------------------ organisation */

export const updateOrganisationSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  timezone: timezoneSchema.optional(),
  gstRate: z
    .number({ invalid_type_error: "GST rate must be a number." })
    .min(0, "GST rate cannot be negative.")
    .max(0.5, "GST rate cannot exceed 50%.")
    .optional(),
  retentionYearsClinical: z
    .number({ invalid_type_error: "Retention period must be a number." })
    .int("Retention period must be a whole number of years.")
    .min(1, "Retention must be at least 1 year.")
    .max(30, "Retention cannot exceed 30 years.")
    .optional(),
});
export type UpdateOrganisationInput = z.infer<typeof updateOrganisationSchema>;

/* ----------------------------------------------------------------- clinics */

export const createClinicSchema = z.object({
  name: z.string().trim().min(2, "Enter a clinic name.").max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, "Use 2–8 letters or numbers, for example RICHMOND."),
  timezone: timezoneSchema.optional(),
  phone: optionalText(40),
  email: z.union([emailSchema, z.literal("")]).optional(),
  addressLine1: optionalText(160),
  suburb: optionalText(80),
  state: z
    .union([z.enum(AU_STATE_CODES), z.literal("")])
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  postcode: z
    .union([
      z
        .string()
        .trim()
        .regex(/^\d{4}$/, "Australian postcodes are 4 digits."),
      z.literal(""),
    ])
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});
export type CreateClinicInput = z.infer<typeof createClinicSchema>;

export const updateClinicSchema = createClinicSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;

/* ------------------------------------------------------------------- staff */

export const inviteStaffSchema = z.object({
  email: emailSchema,
  roleId: uuidSchema,
  fullName: optionalText(120),
  title: optionalText(80),
  clinicIds: optionalUuidArray,
});
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;

export const updateMembershipSchema = z.object({
  roleId: uuidSchema.optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  title: optionalText(80),
  clinicIds: optionalUuidArray.optional(),
});
export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;

/* ------------------------------------------------------------------- roles */

export const createRoleSchema = z.object({
  name: z.string().trim().min(2, "Enter a role name.").max(60),
  description: optionalText(240),
  permissions: z
    .array(z.string().min(3).max(60))
    .max(80, "Too many permissions selected.")
    .default([]),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = createRoleSchema.partial();
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

/* ------------------------------------------------------------- audit/query */

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  cursor: z.string().uuid().optional(),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export const DEFAULT_RETENTION_YEARS = DEFAULT_CLINICAL_RETENTION_YEARS;
