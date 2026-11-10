# Database schema

PostgreSQL 18, Prisma ORM. Schema: `packages/database/prisma/schema.prisma`. Migrations:
`packages/database/prisma/migrations`.

## Contents

- [Conventions](#conventions)
- [Phase 1 entities](#phase-1-entities)
- [Verification](#verification)
- [Planned schema (later phases)](#planned-schema-later-phases)

## Conventions

- UUID primary keys (`@db.Uuid`, `uuid()`), no sequential ids in URLs.
- `organisationId` on every tenant-owned table, indexed; it is always derived from the session.
- `createdAt`/`updatedAt`; `deletedAt` soft delete on foundation entities.
- `AuditEvent` has no `updatedAt` — append-only by construction.
- Compound uniques for natural keys so duplicates are rejected by the database, not just by code.
- Money and tax use `Decimal` (never float). `gstRate` is `Decimal(5,4)`.

## Phase 1 entities

### Organisation

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | PK |
| name | text | |
| slug | text | unique, URL-safe, derived at signup |
| timezone | text | default `Australia/Sydney` |
| currency | text | default `AUD` |
| locale | text | default `en-AU` |
| gstRate | decimal(5,4) | default `0.1000` |
| retentionYearsClinical | int | default 7 |
| status | enum | `ACTIVE`, `SUSPENDED` |
| deletedAt | timestamptz? | soft delete |

### Clinic

`organisationId` → Organisation (cascade), `name`, `code` (unique per organisation), `timezone`,
`phone`, `email`, address fields (`addressLine1`, `suburb`, `state`, `postcode`, `country`),
`status` (`ACTIVE`/`INACTIVE`), `deletedAt`.

Indexes: `(organisationId)`, `(organisationId, status)`, unique `(organisationId, code)`.

### Department

`clinicId` → Clinic (cascade), `name`, `kind?`, unique `(clinicId, name)`.

### User

Global identity: `email` (unique, lower-cased), `fullName`, `passwordHash?`, `status`
(`ACTIVE`/`DISABLED`), `mfaEnabled` (reserved), `failedLoginCount`, `lockedUntil`, `lastLoginAt`,
`deletedAt`.

### Membership

Joins a user to an organisation with exactly one role: `organisationId`, `userId`, `roleId`,
`title?`, `status` (`ACTIVE`/`SUSPENDED`), `deletedAt`. Unique `(organisationId, userId)`.

### MembershipClinic

Explicit clinic access: `membershipId` → Membership (cascade), `clinicId` → Clinic (cascade),
unique `(membershipId, clinicId)`. **No rows means access to all clinics in the organisation** —
this is resolved in `AuthService.resolveAuth` and documented in the API contract.

### Role

`organisationId` → Organisation, `name` (unique per organisation), `description?`, `isSystem`,
`systemKey?` (unique per organisation, nullable), `permissions text[]`. Custom roles have
`isSystem = false`. The `org_admin` role is protected by the service layer.

### Session

`userId`, `organisationId`, `tokenHash` (unique, SHA-256 of the raw token), `ipAddress?`,
`userAgent?`, `lastSeenAt`, `expiresAt`, `revokedAt?`, `revokedReason?`. Indexes on `userId`,
`organisationId`, `expiresAt`.

### PasswordResetToken

`userId`, `tokenHash` (unique), `expiresAt`, `usedAt?`, `requestedIp?`.

### Invitation

`organisationId`, `email`, `fullName?`, `title?`, `roleId`, `clinicIds uuid[]`, `invitedById`,
`tokenHash` (unique), `expiresAt`, `acceptedAt?`, `revokedAt?`. Pending invitations are those with
no `acceptedAt`/`revokedAt` and a future `expiresAt`.

### AuditEvent

`organisationId`, `clinicId?`, `actorUserId?`, `actorLabel`, `action`, `entityType`, `entityId?`,
`summary`, `metadata jsonb?`, `ipAddress?`, `userAgent?`, `requestId?`, `createdAt`.

Indexes: `(organisationId, createdAt DESC)`, `(organisationId, entityType, entityId)`, `(clinicId)`.
Relations use `onDelete: SetNull` for actor/clinic so history survives the removal of a user or
clinic.

### Configuration

`organisationId`, `clinicId?`, `key`, `value jsonb`, `updatedAt`, unique
`(organisationId, clinicId, key)`. Note: PostgreSQL treats NULLs as distinct in unique indexes, so
organisation-level rows are deduplicated in application code until a partial unique index is added.

## Verification

```bash
pnpm db:migrate          # apply migrations
pnpm --filter @vetnex/database studio
```

Migration SQL is committed at `packages/database/prisma/migrations/0001_init/migration.sql`
(generated from the schema, not hand-written).

## Planned schema (later phases)

`Client`, `ClientContact`, `Patient`, `Species`, `Breed`, `Microchip`, `PatientAlert`,
`Appointment`, `Encounter`, `ClinicalNote` (+ `ClinicalNoteVersion`), `Observation`, `Diagnosis`,
`Treatment`, `Prescription`, `MedicationAdministration`, `Vaccination`, `Allergy`,
`LaboratoryOrder`, `LaboratoryResult`, `ImagingStudy`, `HospitalAdmission`, `Product`, `Service`,
`PriceList`, `Estimate`, `Invoice`, `InvoiceLine`, `Payment`, `Refund`, `TaxRate`,
`InventoryItem`, `StockBatch`, `StockMovement`, `Supplier`, `PurchaseOrder`,
`ControlledDrugLedgerEntry`, `Message`, `Reminder`, `AutomationRule`, `IntegrationConnection`,
`WebhookSubscription`, `ImportJob`, `AIRequest`, `AIReview`.

Design rules already fixed for those phases: clinical rows are append-only with explicit
amendments; signed records are never mutated; inventory movements are a ledger, not a balance
field; invoices are immutable once issued (void and reissue).
