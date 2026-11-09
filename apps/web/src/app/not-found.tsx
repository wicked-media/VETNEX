import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">That page does not exist</h1>
        <p className="text-sm text-muted-foreground">
          The link may be out of date. Everything you have access to is in the sidebar.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
