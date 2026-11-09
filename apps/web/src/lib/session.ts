import { cache } from "react";
import type { SessionPayload } from "@vetnex/shared";
import { apiFetchOptional } from "./api";

/**
 * Reads the current session once per request. Returning null (rather than throwing)
 * lets layouts decide between redirecting and rendering.
 */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  return apiFetchOptional<SessionPayload>("/auth/session");
});
