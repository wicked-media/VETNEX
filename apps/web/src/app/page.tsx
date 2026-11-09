import { redirect } from "next/navigation";
import { apiFetchOptional } from "@/lib/api";
import type { SessionPayload } from "@vetnex/shared";

export default async function RootPage() {
  const session = await apiFetchOptional<SessionPayload>("/auth/session");
  redirect(session ? "/dashboard" : "/login");
}
