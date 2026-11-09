import { cookies } from "next/headers";
import type { ApiErrorBody } from "@vetnex/shared";

const API_ORIGIN = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "vetnex_session";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(status: number, body: ApiErrorBody | null, fallback: string) {
    super(body?.error.message ?? fallback);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.error.code ?? "REQUEST_FAILED";
    this.fieldErrors = body?.error.fieldErrors;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Server-side request to the API. Used by server components and route handlers so
 * the session cookie is forwarded without ever exposing it to client JavaScript.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { authenticated?: boolean } = {},
): Promise<T> {
  const { authenticated = true, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("accept", "application/json");

  if (authenticated) {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE)?.value;
    if (session) headers.set("cookie", `${SESSION_COOKIE}=${session}`);
  }

  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...rest,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = null;
    }
    throw new ApiError(response.status, body, `Request failed (${response.status})`);
  }

  const text = await response.text();
  if (text.length === 0) return null as T;
  return JSON.parse(text) as T;
}

/** Returns null instead of throwing on 401, for optional session reads. */
export async function apiFetchOptional<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path);
  } catch (error) {
    if (isApiError(error) && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}
