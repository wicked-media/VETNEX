# ADR 0006 — Invitation and reset tokens in development without an email provider

**Date:** 2026-11-08
**Status:** Provisional — must be replaced before any pilot

## Context

Staff invitations and password resets need to deliver a secret link out of band. VETNEX has no
transactional email provider configured (no account, no verified sending domain, no spend
authorisation). Faking email delivery would make the flows untestable and dishonest.

## Decision

- Generate cryptographically random, single-use tokens; store only SHA-256 hashes with expiry
  (invitation 72 hours, reset 60 minutes).
- When `AUTH_DEV_TOKEN_DELIVERY=true` **and** `NODE_ENV !== "production"`, return the token to the
  requesting client and log a clearly labelled development warning. The UI shows the link with an
  explicit "email delivery is not configured" notice.
- In production the flag is ignored: no token is returned and no token is logged. Until a provider is
  connected, invitation and reset flows are unusable in production — deliberately, rather than
  quietly broken.

## Consequences

- The flows are fully testable end to end today, and the integration suite covers create, accept,
  reuse, revoke and expiry.
- There is a real operational gap: production needs a provider before a pilot. `DEPLOYMENT.md` lists
  it as a blocking checklist item.
- Anyone enabling the flag in production cannot do so accidentally: it is ANDed with `NODE_ENV`.

## Follow-up

Select a transactional email provider (e.g. Postmark, Resend, SES) with an Australian-reachable
sending domain, add delivery to a queue with retries, and remove `devToken` from all responses.
