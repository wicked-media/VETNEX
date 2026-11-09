import type { AuthContext } from "./auth.types";

export function actorLabelFor(auth: AuthContext): string {
  return `${auth.user.fullName} (${auth.user.email})`;
}

export function actorIdFor(auth: AuthContext): string {
  return auth.user.id;
}
