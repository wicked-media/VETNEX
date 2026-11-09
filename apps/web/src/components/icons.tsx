import type { SVGProps } from "react";

export type IconName =
  | "dashboard"
  | "staff"
  | "clinics"
  | "roles"
  | "audit"
  | "settings"
  | "search"
  | "sun"
  | "moon"
  | "logout"
  | "menu"
  | "close"
  | "check"
  | "alert"
  | "plus"
  | "chevronDown"
  | "chevronRight"
  | "key"
  | "shield"
  | "clock"
  | "external";

const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="8" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="3" y="15" width="7" height="6" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
    </>
  ),
  staff: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.2 2.5-5.4 5.5-5.4s5.5 2.2 5.5 5.4" />
      <path d="M16.5 6.4a2.9 2.9 0 0 1 0 5.6" />
      <path d="M18 14.6c1.7.6 2.8 2.4 2.8 4.6" />
    </>
  ),
  clinics: (
    <>
      <path d="M4 21V6.2a1.2 1.2 0 0 1 .8-1.1l7-2.2a1.2 1.2 0 0 1 1.5 1.2V21" />
      <path d="M13.3 9h5.5a1.2 1.2 0 0 1 1.2 1.2V21" />
      <path d="M3 21h18" />
      <path d="M8 8.5h2M8 12h2M8 15.5h2M16 12.5h1.5M16 16h1.5" />
    </>
  ),
  roles: (
    <>
      <path d="M12 3l7 2.6v5.6c0 4.2-2.8 7.6-7 9.2-4.2-1.6-7-5-7-9.2V5.6L12 3Z" />
      <path d="m9.2 11.8 2 2 3.6-3.9" />
    </>
  ),
  audit: (
    <>
      <path d="M6 3.5h9.5L20 8v12.5H6z" />
      <path d="M15 3.5V8h5" />
      <path d="M9 12h8M9 15.5h8M9 8.5h3" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3" />
      <circle cx="15" cy="7" r="2.1" />
      <path d="M4 17h5M13 17h7" />
      <circle cx="11" cy="17" r="2.1" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  logout: (
    <>
      <path d="M15 8V6.2A1.7 1.7 0 0 0 13.3 4.5H6.2A1.7 1.7 0 0 0 4.5 6.2v11.6a1.7 1.7 0 0 0 1.7 1.7h7.1a1.7 1.7 0 0 0 1.7-1.7V16" />
      <path d="M10 12h10M17 8.5l3.5 3.5L17 15.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  alert: (
    <>
      <path d="M12 4.5 21 19.5H3L12 4.5Z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  key: (
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="m11 11 9 9M17 17l2-2M14.5 14.5l2-2" />
    </>
  ),
  shield: <path d="M12 3l7 2.6v5.6c0 4.2-2.8 7.6-7 9.2-4.2-1.6-7-5-7-9.2V5.6L12 3Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  external: <path d="M14 4.5h5.5V10M19 5 11 13M17 14v4.3a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 18.3V8.7A1.7 1.7 0 0 1 5.7 7H10" />,
};

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}

/** Wordmark: an original mark built from a cross and a pulse line. */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <rect x="1" y="1" width="30" height="30" rx="9" fill="currentColor" opacity="0.12" />
        <path
          d="M16 7.5v17M7.5 16h17"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.35"
        />
        <path
          d="M8.5 17.5h3.2l2-5 3.1 9 2.3-6.5h4.4"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {compact ? null : (
        <span className="text-[15px] font-semibold uppercase tracking-[0.22em] text-foreground">
          Vetnex
        </span>
      )}
    </span>
  );
}
