import type { Request } from "express";

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Extracts only the request metadata we are willing to store. Request bodies,
 * cookies and authorisation headers are never captured.
 */
export function requestMeta(request: Request): RequestMeta {
  const forwarded = firstHeader(request.headers["x-forwarded-for"]);
  const ip = forwarded?.split(",")[0]?.trim() ?? request.ip ?? undefined;
  return {
    ip: ip?.slice(0, 64),
    userAgent: firstHeader(request.headers["user-agent"])?.slice(0, 255),
    requestId: firstHeader(request.headers["x-request-id"])?.slice(0, 100),
  };
}

export function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    const raw = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}
