# ADR-0011: Cloudflare Worker runtime cutover

## Status

Accepted for the Issue #60 application-runtime migration. Production data import, traffic cutover, and legacy cleanup remain operational Human Gates.

## Decision

1. Auth0 remains the authentication provider. The Worker verifies the Auth0 JWT and resolves the D1 user by `token_identifier`.
2. The browser calls Hono routes through the API client and TanStack Query. Convex React bindings are not part of the current runtime path.
3. D1 owns metadata, private letter content, delivery state, notification outbox, push subscriptions, and attachment metadata. `scheduled_at` is an internal delivery field and is never included in browser projections.
4. Private photos use Worker-issued short-lived HMAC capabilities for upload and download. The R2 bucket is not public, and the Worker checks ownership, letter readability, generation token, purpose, and expiration before serving an object.
5. Cron performs idempotent delivery and notification-job claiming. Queue performs notification delivery. Delivery state and notification success remain separate.
6. Local, Preview, and Production use separate Worker names, D1 databases, R2 buckets, Queue names, and environment flags. Test authentication and force-delivery are local / Preview-only.
7. The Convex source and tests stay available during the rollback window. Removing them requires a successful production cutover, a completed rollback window, and a separate Human Gate.

## Consequences

- The API contract is testable without exposing Convex deployment configuration to the browser.
- CI E2E can deploy one Worker revision and one D1 schema before Playwright.
- Auth0 / Worker CORS and API base URL are now environment concerns; browser public values remain limited to Auth0 and VAPID public configuration.
- A production export and source R2 inventory are still required before data cutover. An empty D1 schema is not a completed migration.
