# ADR-0012: Cloudflare-only Preview runtime

## Status

Accepted on 2026-09-05. Preview is the active runtime. Production remains undeployed and
unpopulated.

## Context

The application runtime has already moved to Cloudflare Worker / D1 / R2 / Queue. The
repository still contained the previous backend's source, browser bindings, scheduled
jobs, dependencies, tests, CI steps, environment examples, and import CLI. Keeping those
paths makes it possible for an old deploy or local command to reintroduce a second runtime.

The Production Worker, Production Auth0 application, and Production business data have
not been deployed. Preview data is disposable and is not a migration source. Therefore
there is no Production rollback window that requires keeping the old runtime in this
repository.

## Decision

1. Cloudflare Worker / Hono, D1, private R2, Queues, and the Worker scheduled handler are
   the only application runtime.
2. Auth0 remains the authentication provider. Worker JWT verification and D1 ownership
   checks are the authorization boundary.
3. Remove the old backend source, client/provider bindings, scheduler definitions,
   dependencies, generated code, tests, CI jobs, environment examples, and migration CLI
   from the repository.
4. Keep `supabase/migrations/` only as a historical comparison artifact. It is not a
   runtime dependency or a data source for Preview.
5. Apply `0003_remove_legacy_import_bookkeeping.sql` so the D1 schema no longer contains
   the temporary import mapping table, index, or triggers.
6. Do not deploy, delete, or mutate Production resources as part of this cleanup.
   Stopping an existing external Preview deployment is a separate service operation and
   must be performed only after its environment and deployment identity are verified.
7. If Production data is discovered later, stop and open a dedicated inventory / export /
   dry-run / rollback task with a Human Gate. Do not reconstruct or import it from Preview.

## Consequences

### Positive

- CI, local development, and Preview have one backend execution path.
- A removed scheduler cannot keep writing to the application database through a stale
  repository deploy.
- Worker / D1 / R2 / Queue tests are the only backend verification surface.
- The no-import decision is explicit because Production has not started.

### Trade-offs

- Existing external Preview resources may require an operator action outside Git.
- Historical architecture records still mention the former design; they are retained as
  decision history and point to this ADR for the current state.
- Production launch still needs a separate Auth0 / Cloudflare setup, inventory check, smoke
  test, and rollback decision.

## Verification

- Repository boundary test confirms no old runtime source, package, config, environment
  example, or CI job remains.
- D1 migration test confirms the temporary bookkeeping objects are absent after all
  migrations.
- Worker unit / integration tests and Preview health / API smoke confirm the active path.
