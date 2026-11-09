import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Security tokens (session tokens, invitations, password resets).
 *
 * Raw tokens are only ever handed to the client; the database stores a SHA-256 hash
 * so that a database disclosure does not yield usable credentials. Lookup is a hash
 * match, which is safe here because tokens are 256-bit random values (no guessing
 * attack is feasible), unlike user-chosen passwords.
 */

export const SESSION_TOKEN_BYTES = 32;

export function generateToken(bytes: number = SESSION_TOKEN_BYTES): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export const TOKEN_TTL = {
  sessionHours: 12,
  invitationHours: 72,
  passwordResetMinutes: 60,
} as const;

export function hoursFromNow(hours: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

export function minutesFromNow(minutes: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + minutes * 60 * 1000);
}
