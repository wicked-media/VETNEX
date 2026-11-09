import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password hashing: scrypt (memory-hard, in Node core) with per-password salt.
 *
 * Argon2id would be preferable, but it requires a native build step that is fragile
 * in restricted build environments. scrypt with N=2^15 is an acceptable, widely
 * reviewed equivalent for this milestone; the stored format records its own
 * parameters so hashes can be upgraded transparently on next successful login.
 */
const CURRENT_PARAMS = { N: 2 ** 15, r: 8, p: 1, keyLength: 64, maxmem: 96 * 1024 * 1024 };
const PREFIX = "scrypt";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;

const OBVIOUS_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "password1234",
  "123456789012",
  "qwertyuiop12",
  "letmein12345",
  "vetnexvetnex",
]);

export interface PasswordPolicyResult {
  readonly ok: boolean;
  readonly issues: readonly string[];
}

/**
 * Length-first policy following current NIST guidance: no forced composition rules,
 * but reject trivially guessable values and cap length to bound hashing cost.
 */
export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  const issues: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    issues.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    issues.push(`Password must be at most ${PASSWORD_MAX_LENGTH} characters.`);
  }
  if (password.trim().length !== password.length || password.trim().length === 0) {
    issues.push("Password cannot start or end with whitespace.");
  }
  if (OBVIOUS_PASSWORDS.has(password.toLowerCase())) {
    issues.push("Password is too common.");
  }
  return { ok: issues.length === 0, issues };
}

export async function hashPassword(password: string): Promise<string> {
  const policy = checkPasswordPolicy(password);
  if (!policy.ok) {
    throw new Error(policy.issues.join(" "));
  }
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), salt, CURRENT_PARAMS.keyLength, {
    N: CURRENT_PARAMS.N,
    r: CURRENT_PARAMS.r,
    p: CURRENT_PARAMS.p,
    maxmem: CURRENT_PARAMS.maxmem,
  });
  return [
    PREFIX,
    CURRENT_PARAMS.N,
    CURRENT_PARAMS.r,
    CURRENT_PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

interface ParsedHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

function parseHash(stored: string): ParsedHash | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) return null;
  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  // Reject unreasonable parameters so a corrupted or hostile hash cannot exhaust memory.
  if (N < 2 ** 12 || N > 2 ** 20 || r < 1 || r > 32 || p < 1 || p > 8) return null;
  const salt = Buffer.from(saltRaw ?? "", "base64");
  const hash = Buffer.from(hashRaw ?? "", "base64");
  if (salt.length < 8 || hash.length < 16) return null;
  return { N, r, p, salt, hash };
}

/** Constant-time password verification. Returns false for malformed stored hashes. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  try {
    const derived = await scrypt(password.normalize("NFKC"), parsed.salt, parsed.hash.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
      maxmem: Math.max(CURRENT_PARAMS.maxmem, 128 * parsed.N * parsed.r * 2),
    });
    return timingSafeEqual(derived, parsed.hash);
  } catch {
    return false;
  }
}

/** True when a stored hash was produced with weaker parameters than the current policy. */
export function passwordHashNeedsRehash(stored: string): boolean {
  const parsed = parseHash(stored);
  if (!parsed) return true;
  return (
    parsed.N < CURRENT_PARAMS.N ||
    parsed.r < CURRENT_PARAMS.r ||
    parsed.p < CURRENT_PARAMS.p ||
    parsed.hash.length < CURRENT_PARAMS.keyLength
  );
}
