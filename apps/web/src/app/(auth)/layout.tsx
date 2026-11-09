import { Wordmark } from "@/components/icons";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[oklch(0.23_0.028_215)] p-10 text-[oklch(0.95_0.006_100)] lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 22%, oklch(0.78 0.09 195) 0, transparent 42%), radial-gradient(circle at 82% 78%, oklch(0.78 0.105 74) 0, transparent 45%)",
          }}
        />
        <div className="relative">
          <div className="text-[oklch(0.82_0.075_195)]">
            <Wordmark />
          </div>
          <p className="mt-10 max-w-md text-balance text-3xl font-semibold leading-tight tracking-tight">
            One place for every patient, every practice, every person.
          </p>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-[oklch(0.8_0.012_210)]">
            VETNEX brings clinical records, scheduling, billing and team administration into a
            single platform built for veterinary practice — with an audit trail that stands up to
            scrutiny.
          </p>
        </div>

        <div className="relative space-y-4">
          <ul className="space-y-2.5 text-[13px] text-[oklch(0.85_0.01_210)]">
            {[
              "Multi-clinic tenancy with role-based access",
              "Immutable audit history for clinical and security events",
              "Australian record retention and GST defaults",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="mt-1.5 block size-1.5 shrink-0 rounded-full bg-[oklch(0.78_0.105_74)]" />
                {line}
              </li>
            ))}
          </ul>
          <p className="max-w-md text-[11px] leading-relaxed text-[oklch(0.7_0.01_210)]">
            Development build. Synthetic data only. Compliance statements describe design intent,
            not certification.
          </p>
        </div>
      </aside>

      <main id="main" className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-primary lg:hidden">
            <Wordmark />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
