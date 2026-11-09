# Product requirements

## Product statement

VETNEX is a cloud-first veterinary practice platform. It replaces the split between practice
management software, clinical records, communications and billing with one system that a whole
practice works inside — reception, consulting rooms, surgery, wards, pharmacy, management and,
in later phases, pet owners.

Initial market: Australia. Architecture supports international deployment through per-organisation
regional settings.

## Who it is for

| Persona | Works in | Needs |
| --- | --- | --- |
| Practice owner / director | Dashboard, settings, audit | Confidence in access control, retention, costs, and that records are defensible |
| Practice manager | Team, roles, clinics, reporting | Fast staff onboarding, correct permissions, no accidental lockouts |
| Veterinarian | Consultations, patient record, prescribing | Speed, keyboard-first entry, complete history at a glance, sign-off they control |
| Veterinary nurse | Wards, treatments, stock | Clear task lists, treatment sheets, stock accuracy |
| Receptionist | Schedule, clients, payments | Few clicks to book, check in, invoice, take payment |
| Locum / visiting specialist | Read-only or scoped access | Temporary, auditable, time-boxed access |
| Pet owner (later) | Portal | Booking, reminders, estimates, documents |

## Phase 1 scope (this increment) — implemented

**Organisation and access**

- Self-serve creation of an organisation, its first clinic, six default roles and an owner account.
- Multi-clinic structure with per-clinic staff assignment; empty assignment means all clinics.
- Staff invitations (72-hour tokens), acceptance, role assignment, suspension, clinic scoping.
- Custom roles built from an explicit permission catalogue.
- Protected owner role; a practice can never lose its last active owner.
- Append-only audit trail with actor, request id and before/after metadata for settings changes.
- Regional defaults: time zone, AUD, GST rate, clinical retention years.

**Platform**

- Session authentication with lockout, session revocation and password reset that revokes sessions.
- Tenant-scoped data access on every read and write.
- Responsive application shell: permission-aware navigation, command palette, light/dark themes.
- Dashboard showing real organisation state and a setup checklist (no invented metrics).

## Acceptance criteria — Phase 1

| # | Criterion | Status |
| --- | --- | --- |
| 1 | A new practice can be created and signed into without manual database work | Passing (`auth.spec.ts`) |
| 2 | Users cannot read or modify another organisation's clinics, staff, roles, sessions or audit | Passing (`tenancy.spec.ts`) |
| 3 | A role without `staff:invite` cannot invite staff; without `organisation:manage` cannot change settings | Passing (`rbac.spec.ts`) |
| 4 | The owner role cannot be edited or deleted; the last owner cannot be removed | Passing (`rbac.spec.ts`, `auth.spec.ts`) |
| 5 | Permissions for unshipped modules cannot be granted | Passing (`rbac.spec.ts`) |
| 6 | Audit entries record actor and change metadata, and cannot be edited or deleted through the API | Passing (`audit.spec.ts`) |
| 7 | Sign-out and password reset invalidate the session | Passing (`auth.spec.ts`) |
| 8 | A disabled account cannot sign in | Covered by lockout/disabled checks (`auth.spec.ts`) |
| 9 | Every workspace typechecks and the app starts locally | Passing |
| 10 | Invitations and password resets deliver a usable link without an email provider | Passing in development only — production requires an email provider |

## Explicitly out of scope for Phase 1

Clients and patients, appointments, consulting/SOAP notes, hospital and ward workflows, prescribing
and controlled drugs, estimates/invoices/payments, inventory, laboratory and imaging, client portal,
online booking, SMS/email, AI assistance, offline mode, migration from OpenVPMS, SSO/MFA.

These are described in `ROADMAP.md`. None is stubbed in the interface: no menu item leads to a
non-functional screen.

## Product decisions taken (with rationale)

1. **Foundation before features.** Clinical software fails on access control and record integrity,
   not on missing dashboards. Tenancy, audit and permissions are built and tested first.
2. **Explicit permission grants.** No "full access except" model; every code is named and
   enumerated, and permissions that cannot yet be enforced are visibly unavailable.
3. **Honest dashboard.** Metrics come from real queries. An empty practice shows zeros, not samples.
4. **Australian defaults, configurable.** Time zone, GST and retention are organisation settings;
   clinics can override time zone.
5. **Small-animal general practice first**, with a data model (species-agnostic patients, clinic
   hierarchy) that can extend to equine, livestock, emergency and specialist workflows.

## Open product questions

- Which laboratory and imaging providers to integrate first (drives the adapter interface).
- Whether payments are captured in-platform (Stripe) or reconciled from an existing terminal.
- Whether the first pilot needs OpenVPMS history import at go-live or after.
- Retention defaults per state/territory — requires legal review (`COMPLIANCE_ASSUMPTIONS.md`).
