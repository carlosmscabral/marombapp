# Firestore Migration Tool: `(default)` → `marombapp` (#15, ADR-004, ADR-005)

One-off Node CLI (`firebase-admin`) that copies real MarombApp data from `projects/vibe-cabral/databases/(default)` into `projects/vibe-cabral/databases/marombapp` (`REQ-002`, `REQ-004`, `REQ-006`, `ADR-004`, `ADR-005`).

## DANGER — Post-Cutover Data-Loss Guardrails (`ADR-005`)

> **WARNING:** `--apply` **purges all existing documents** in `marombapp` across `exercises`, `plans` (and each plan's `days` subcollection), and `sessions` before writing the `(default)` snapshot.

1. **Permitted runs only:** Run `--apply` **only** for (a) the initial copy into `marombapp` and (b) the single cutover re-run immediately after the PO stops logging in the legacy app (`vibe-cabral.web.app`).
2. **NEVER re-run after the PO starts using the new app (`marombapp-serving`):** Under `ADR-005`, `marombapp` becomes the PO's production data store at cutover. Any workout, custom exercise, or training plan created in `marombapp` after cutover does not exist in `(default)` and would be destroyed by a purge.
3. **Pre-apply guard (last line of defense):** Before deleting or writing anything, `--apply` inspects `marombapp` and aborts with exit code `1` (`0` deletes, `0` writes) if the target contains real data absent from `(default)`:
   - any `sessions` doc whose ID is not in `(default)` (overrideable only via emergency `--force-purge-target-sessions[=id1,id2]`, which prints the destroyed session IDs), OR
   - any `exercises` doc with `isCustom === true` whose ID is not in `(default)`, OR
   - any `plans` doc not in `(default)` that has `>= 1` `days` subcollection doc.
   Pre-cutover test leftovers (`isCustom: false` seeded built-in exercises and empty `0`-day test plans) are permitted to be purged. `--dry-run` reports any guard condition via `GUARD WOULD BLOCK --apply`.
4. **Keep `marombapp-serving` closed in all browser tabs during `--apply`:** Purge-then-copy runs across sequential batches and is not atomic. An open client tab during the brief purge window could trigger `seedLibraryIfEmpty()` (66 random-ID built-in exercises), which the verification pass will flag with a count mismatch (`exit 1`).

## Safety Guarantees

1. **Read-only source in code:** `(default)` (never the empty named DB `default`) is wrapped in `createReadOnlySource()`, a frozen facade exposing only allowlisted `collection`, `listDocuments`, `doc`, and `get` calls (`0` write/delete/batch/`listCollections` methods).
2. **Strict collection allowlist:** Reads and copies **only** `exercises`, `plans` (+ `plans/{planId}/days/{dayId}`), and `sessions`. The 14 unrelated collections in `(default)` (`conversions`, `global_workouts`, `bookings`, etc.) are never enumerated or read.
3. **Target `(default)` / `default` refusal:** Both CLI parsing and `runCopyMigration()` reject `'(default)'`, `'default'`, empty strings, or any `Firestore` handle whose `databaseId` resolves to `(default)` or `default`.
4. **Dry-run by default:** Running without `--apply` deletes nothing and writes nothing (`0` batches committed) while reporting `source`, `targetBefore`, `wouldDelete`, `wouldWrite`, and pre-apply guard status.
5. **Target purge spares `eval_runs` (`--apply` only):** `eval_runs` (and any other non-allowlisted collection in `marombapp`) is never read or touched, enforced by `assertAllowlistedDocPath()`.
6. **Verbatim fields, IDs, Timestamps & bounded batches:** Copies documents with exact IDs and verbatim payloads (`equipment`, `restSec`, `restTimer`, `Timestamp` on `plans.createdAt`, epoch-ms numbers on `sessions`) in batches of `<= 400` operations (`--batch-size`, max `400`), then verifies `targetAfter === source` across all 4 collection buckets.

## Usage (Run by `deployer` with ADC)

Authenticate with Application Default Credentials (`marombapp-deployer@vibe-cabral`).

```bash
# 1. Dry-run inventory & guard check (default — deletes and writes nothing)
node scripts/migrate/copy-default-to-marombapp.mjs

# 2. Initial copy or single cutover re-run (keep new app closed in browser)
node scripts/migrate/copy-default-to-marombapp.mjs --apply
```
