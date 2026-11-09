# Compliance assumptions

> **Not legal advice.** These are engineering assumptions recorded so that qualified advisers can
> review them. No certification, accreditation or regulatory approval is claimed or implied by any
> feature in this repository.

## Jurisdiction

Initial operation in Australia. Obligations for veterinary records vary by state and territory, and
by business structure. VETNEX therefore makes policy configurable and records the configuration,
rather than encoding one jurisdiction's rules as universal.

## Assumptions recorded

1. **Record retention.** Organisations configure `retentionYearsClinical` (default 7). The default is
   a conservative starting point, not a legal determination. Deletion is soft by default so records
   remain recoverable and auditable.
2. **Clinical accountability.** Clinical records must identify the responsible clinician. Phase 3
   implements `clinical:sign` and immutable amendment history; in this phase the concept exists only
   as a permission code marked `planned` and cannot be granted.
3. **Audit history.** Security and record events are append-only, with actor, timestamp and request
   id. Records must not be destroyed to "tidy" a practice's data.
4. **Controlled drugs.** Registers, witnessed dispensing and jurisdiction-specific schedules are
   **not implemented**. They must not be represented as available until veterinary and legal review
   completes. `inventory:*` permissions are `planned`.
5. **Consent records.** Consent for recording, data sharing and communications is planned with the
   client portal and AI scribe. No recording feature exists yet.
6. **Privacy Act 1988 / Australian Privacy Principles.** The design assumes: collect only what is
   needed, restrict access to a need-to-know basis, support export and correction, log access to
   sensitive records, and enable deletion subject to record-keeping duties. A formal APPs assessment
   and privacy policy are required before handling real client data.
7. **Tax.** GST is configurable (default 10%) and applied deterministically per line when billing
   ships. Tax treatment of veterinary services and products must be confirmed with an accountant.
8. **Time and dates.** `Australia/Sydney` default; all timestamps stored in UTC (`timestamptz`) and
   rendered in the organisation or clinic time zone. Daylight saving is handled by IANA data.
9. **Data residency.** The intended production region is AWS Sydney. This is a deployment target,
   not a current fact — no infrastructure exists.
10. **Cross-border processing.** AI providers may process data outside Australia. This requires
    disclosure, consent where applicable, and a provider assessment before enablement.
11. **Retention of audit and financial records.** Audit entries are not purged by the application.
    Financial record retention rules apply once invoicing exists.
12. **Access requests.** Data export is planned; the schema is export-friendly (UUIDs, explicit
    relations). No import/export pipeline exists in this phase.

## Obligations on the operator

- Confirm record-keeping requirements for each state/territory of operation.
- Confirm controlled-drug obligations before enabling pharmacy workflows.
- Complete a privacy impact assessment before real client data is loaded.
- Configure backups, retention and access reviews appropriate to their practice.
- Ensure staff receive access appropriate to their role and that departed staff are suspended.

## Engineering guardrails that follow from the above

- Never present configurable settings as proof of compliance.
- Never delete clinical or financial history destructively.
- Never allow AI to finalise clinical documentation.
- Never permit a permission for an unshipped control (enforced by
  `validateGrantablePermissions`).
- Document every regulatory assumption in this file as it is discovered.
