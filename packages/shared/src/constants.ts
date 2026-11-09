/**
 * Regional and product constants. VETNEX launches in Australia and treats
 * Australian defaults as the system default, while every value here is
 * overridable per organisation.
 */

export const DEFAULT_TIMEZONE = "Australia/Sydney";
export const DEFAULT_CURRENCY = "AUD";
export const DEFAULT_LOCALE = "en-AU";
export const DEFAULT_GST_RATE = 0.1;
export const DEFAULT_CLINICAL_RETENTION_YEARS = 7;

/** Time zones offered in the UI. IANA identifiers, evaluated with Intl. */
export const TIMEZONES = [
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Hobart",
  "Australia/Darwin",
  "Australia/Canberra",
  "Pacific/Auckland",
  "Asia/Singapore",
  "Europe/London",
  "America/Los_Angeles",
  "America/New_York",
  "UTC",
] as const;

export type TimezoneName = (typeof TIMEZONES)[number];

export const AU_STATES = [
  { code: "NSW", name: "New South Wales" },
  { code: "VIC", name: "Victoria" },
  { code: "QLD", name: "Queensland" },
  { code: "WA", name: "Western Australia" },
  { code: "SA", name: "South Australia" },
  { code: "TAS", name: "Tasmania" },
  { code: "ACT", name: "Australian Capital Territory" },
  { code: "NT", name: "Northern Territory" },
] as const;

export type AustralianStateCode = (typeof AU_STATES)[number]["code"];

export const AU_STATE_CODES = AU_STATES.map((state) => state.code) as unknown as [
  AustralianStateCode,
  ...AustralianStateCode[],
];

/** Maximum number of attempts before an account lockout is applied. */
export const LOGIN_MAX_FAILED_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MINUTES = 15;
