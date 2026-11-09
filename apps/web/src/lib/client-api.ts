"use client";

import type { ApiErrorBody } from "@vetnex/shared";

const BASE = "/api/vetnex";

export class ClientApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly practices?: Array<{ id: string; name: string }>;

  constructor(status: number, body: ApiErrorBody | null, fallback: string) {
    super(body?.error.message ?? fallback);
    this.name = "ClientApiError";
    this.status = status;
    this.code = body?.error.code ?? "REQUEST_FAILED";
    this.fieldErrors = body?.error.fieldErrors;
    this.practices = body?.error.practices;
  }
}

/**
 * Browser request through the same-origin proxy. Cookies are sent automatically,
 * so no token ever touches client-side storage.
 */
export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const { method = "GET", body, signal } = options;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    signal,
  });

  if (!response.ok) {
    let parsed: ApiErrorBody | null = null;
    try {
      parsed = (await response.json()) as ApiErrorBody;
    } catch {
      parsed = null;
    }
    throw new ClientApiError(response.status, parsed, `Request failed (${response.status})`);
  }

  const text = await response.text();
  if (text.length === 0) return null as T;
  return JSON.parse(text) as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ClientApiError || error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
