import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const showDemo = process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === "true";

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use your practice account. Sessions end after 12 hours of inactivity.
        </p>
      </div>

      <LoginForm showDemo={showDemo} />
    </div>
  );
}
