import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create your practice" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create your practice</h1>
        <p className="text-sm text-muted-foreground">
          Sets up your organisation, first clinic and owner account. You can add more clinics and
          invite your team afterwards.
        </p>
      </div>
      <SignupForm />
    </div>
  );
}
