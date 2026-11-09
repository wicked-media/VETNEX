import { describe, expect, it } from "vitest";
import {
  createClinicSchema,
  emailSchema,
  inviteStaffSchema,
  loginSchema,
  signupSchema,
  updateOrganisationSchema,
} from "../schemas";

describe("emailSchema", () => {
  it("normalises case and whitespace", () => {
    expect(emailSchema.parse("  Alex.Morgan@Riverbend.VET ")).toBe("alex.morgan@riverbend.vet");
  });

  it("rejects malformed addresses", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
    expect(emailSchema.safeParse("missing@tld").success).toBe(false);
  });
});

describe("signupSchema", () => {
  const valid = {
    organisationName: "Riverbend Veterinary Group",
    clinicName: "Riverbend Main Hospital",
    fullName: "Alex Morgan",
    email: "alex@riverbend.vet",
    password: "Riverbend-Clinic-42",
  };

  it("applies Australian defaults", () => {
    const result = signupSchema.parse(valid);
    expect(result.timezone).toBe("Australia/Sydney");
  });

  it("requires a password of at least 12 characters", () => {
    expect(signupSchema.safeParse({ ...valid, password: "shortpass12x" }).success).toBe(true);
    expect(signupSchema.safeParse({ ...valid, password: "shortpass1" }).success).toBe(false);
  });

  it("rejects an unsupported time zone", () => {
    expect(signupSchema.safeParse({ ...valid, timezone: "Mars/Olympus" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("does not enforce current password policy on existing passwords", () => {
    expect(loginSchema.safeParse({ email: "a@b.vet", password: "old" }).success).toBe(true);
  });
});

describe("createClinicSchema", () => {
  it("uppercases the code and accepts an Australian address", () => {
    const parsed = createClinicSchema.parse({
      name: "Seaford Clinic",
      code: "seaford",
      postcode: "3198",
      state: "VIC",
    });
    expect(parsed.code).toBe("SEAFORD");
    expect(parsed.postcode).toBe("3198");
  });

  it("rejects invalid codes and postcodes", () => {
    expect(createClinicSchema.safeParse({ name: "X", code: "A" }).success).toBe(false);
    expect(
      createClinicSchema.safeParse({ name: "Clinic", code: "CLINIC1", postcode: "319" }).success,
    ).toBe(false);
    expect(
      createClinicSchema.safeParse({ name: "Clinic", code: "CLINIC1", state: "XX" }).success,
    ).toBe(false);
  });
});

describe("inviteStaffSchema", () => {
  it("defaults clinic selection to all clinics", () => {
    const parsed = inviteStaffSchema.parse({
      email: "nurse@clinic.vet",
      roleId: "0f0a1b2c-3d4e-5f60-8712-9a3b4c5d6e7f",
    });
    expect(parsed.clinicIds).toEqual([]);
  });
});

describe("updateOrganisationSchema", () => {
  it("rejects impossible GST and retention values", () => {
    expect(updateOrganisationSchema.safeParse({ gstRate: 1.5 }).success).toBe(false);
    expect(updateOrganisationSchema.safeParse({ retentionYearsClinical: 0 }).success).toBe(false);
    expect(updateOrganisationSchema.safeParse({ retentionYearsClinical: 7.5 }).success).toBe(false);
    expect(updateOrganisationSchema.safeParse({ gstRate: 0.1, retentionYearsClinical: 7 }).success).toBe(
      true,
    );
  });
});
