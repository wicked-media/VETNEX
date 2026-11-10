# Roadmap

Sequenced by risk, not by demo appeal. Each phase ends with working software and passing tests.

## Contents

- [Phase 0 — Discovery and architecture ✅](#phase-0-discovery-and-architecture)
- [Phase 1 — Foundation ✅ (this increment)](#phase-1-foundation-this-increment)
- [Phase 2 — Clients, patients and scheduling](#phase-2-clients-patients-and-scheduling)
- [Phase 3 — Clinical workflows](#phase-3-clinical-workflows)
- [Phase 4 — Financial and inventory](#phase-4-financial-and-inventory)
- [Phase 5 — Pilot readiness](#phase-5-pilot-readiness)
- [Phase 6 — Platform](#phase-6-platform)
- [Engineering debt to schedule deliberately](#engineering-debt-to-schedule-deliberately)

## Phase 0 — Discovery and architecture ✅

Product requirements, personas, domain model, architecture decisions, security and compliance
assumptions, monorepo structure.

## Phase 1 — Foundation ✅ (this increment)

Monorepo, PostgreSQL + Prisma, authentication and sessions, organisations/clinics/departments, roles
and permissions, invitations, password reset, audit trail, design system, application shell,
dashboard, typecheck and integration tests.

Still outstanding from the original Phase 1 brief:

- [ ] CI pipeline (GitHub Actions: typecheck, tests, dependency scan)
- [ ] MFA enrolment, passkeys (architecture fields exist)
- [ ] Playwright end-to-end suite and accessibility checks
- [ ] OpenAPI generation from the shared Zod contracts

## Phase 2 — Clients, patients and scheduling

- [ ] Client records, contacts, addresses, communication preferences, duplicate detection
- [ ] Patient records: species/breed, microchip, weight and observations, allergies, alerts,
      documents, chronological history
- [ ] Ownership relationships and authorised contacts
- [ ] Appointment calendar: day/week/resource views, drag and drop, appointment types, collision
      detection, check-in/checkout, no-show handling
- [ ] Client and patient search with server-side pagination
- [ ] Dashboard modules: today's appointments, waiting room, clinician workload

## Phase 3 — Clinical workflows

- [ ] Encounters from appointments; SOAP editor with templates
- [ ] Vitals, diagnoses, treatments, prescriptions, attachments
- [ ] Draft → signed lifecycle with `clinical:sign`, immutable amendments
- [ ] Clinical document generation (consult summary, discharge instructions, prescriptions)
- [ ] Hospital admission, ward board, treatment sheets
- [ ] Controlled-drug register (after veterinary/legal validation)

## Phase 4 — Financial and inventory

- [ ] Product/service catalogue, price lists, estimates
- [ ] Invoices with GST, discounts with permission, partial payments, refunds, credit notes
- [ ] Payment gateway integration with idempotent webhooks
- [ ] Inventory ledger, batches, expiry, stocktake, purchase orders
- [ ] Xero/MYOB accounting sync
- [ ] Invoice and receipt PDFs with printer routing abstraction

## Phase 5 — Pilot readiness

- [ ] Security review, penetration test, dependency scanning in CI
- [ ] Backup/restore rehearsal, incident response runbook
- [ ] OpenVPMS import framework: mapping UI, validation, dry run, reconciliation report, rollback
- [ ] Playwright suite for the full consultation-to-payment workflow
- [ ] Performance budget verification at representative load
- [ ] Supervised pilot with one clinic

## Phase 6 — Platform

- [ ] AI: history summaries (clinician-reviewed), SOAP drafting, transcription with consent,
      charge capture suggestions, practice analytics queries
- [ ] Communications: SMS/email, reminders, templates, automation rules
- [ ] Client portal and online booking
- [ ] Integrations: laboratory, imaging/DICOM, wholesalers, PrintNode, microchip registries
- [ ] Offline-first mobile for field and mobile vets, with conflict reconciliation
- [ ] Enterprise: SSO/SAML, consolidated multi-site reporting, governance controls

## Engineering debt to schedule deliberately

| Item | Why it matters | Target |
| --- | --- | --- |
| Database row-level security | Defence in depth for tenant isolation | Phase 5 |
| Cursor pagination everywhere | Consistent performance on large datasets | Phase 2 |
| Background jobs (BullMQ) | Imports, reports, reminders must not block requests | Phase 3 |
| Transactional outbox | Reliable integration events | Phase 4 |
| Structured logging + tracing | Diagnose production issues | Phase 5 |
| Compiled API build | Faster cold start, smaller image | Phase 5 |
