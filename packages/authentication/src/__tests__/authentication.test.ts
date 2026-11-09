import { describe, expect, it } from "vitest";
import {
  checkPasswordPolicy,
  hashPassword,
  passwordHashNeedsRehash,
  verifyPassword,
} from "../password";
import { generateToken, hashToken, TOKEN_TTL, tokensEqual } from "../tokens";

describe("password hashing", () => {
  it("round-trips a valid password", async () => {
    const hash = await hashPassword("Riverbend-Clinic-42");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Riverbend-Clinic-42", hash)).toBe(true);
  });

  it("rejects the wrong password and malformed hashes", async () => {
    const hash = await hashPassword("Riverbend-Clinic-42");
    expect(await verifyPassword("Riverbend-Clinic-43", hash)).toBe(false);
    expect(await verifyPassword("Riverbend-Clinic-42", "not-a-hash")).toBe(false);
    expect(await verifyPassword("Riverbend-Clinic-42", "")).toBe(false);
  });

  it("salts each hash so identical passwords differ", async () => {
    const [a, b] = await Promise.all([
      hashPassword("Riverbend-Clinic-42"),
      hashPassword("Riverbend-Clinic-42"),
    ]);
    expect(a).not.toEqual(b);
  });

  it("refuses to hash a password that fails policy", async () => {
    await expect(hashPassword("short")).rejects.toThrow();
  });

  it("detects hashes that need upgrading", async () => {
    const hash = await hashPassword("Riverbend-Clinic-42");
    expect(passwordHashNeedsRehash(hash)).toBe(false);
    expect(passwordHashNeedsRehash("scrypt$4096$8$1$c2FsdHNhbHQ=$aGFzaGhhc2hoYXNoaGFzaA==")).toBe(true);
  });

  it("rejects hostile cost parameters instead of exhausting memory", async () => {
    expect(
      await verifyPassword("whatever-long-password", "scrypt$1073741824$8$1$c2FsdA==$aGFzaA=="),
    ).toBe(false);
  });
});

describe("password policy", () => {
  it("accepts a long passphrase", () => {
    expect(checkPasswordPolicy("Riverbend-Clinic-42").ok).toBe(true);
  });

  it("reports each failure", () => {
    expect(checkPasswordPolicy("short").issues).toHaveLength(1);
    expect(checkPasswordPolicy("Riverbend-Clinic-42 ").issues).toHaveLength(1);
    expect(checkPasswordPolicy("password1234").issues).toHaveLength(1);
    expect(checkPasswordPolicy("short ").issues.length).toBeGreaterThanOrEqual(2);
  });
});

describe("tokens", () => {
  it("generates url-safe high-entropy tokens", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(42);
    expect(generateToken()).not.toEqual(token);
  });

  it("hashes deterministically without leaking the token", () => {
    const token = generateToken();
    expect(hashToken(token)).toEqual(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(token)).toHaveLength(64);
  });

  it("compares in constant time", () => {
    expect(tokensEqual("abc", "abc")).toBe(true);
    expect(tokensEqual("abc", "abd")).toBe(false);
    expect(tokensEqual("abc", "abcd")).toBe(false);
  });

  it("uses sensible lifetimes", () => {
    expect(TOKEN_TTL.sessionHours).toBeLessThanOrEqual(24);
    expect(TOKEN_TTL.passwordResetMinutes).toBeLessThanOrEqual(120);
  });
});
