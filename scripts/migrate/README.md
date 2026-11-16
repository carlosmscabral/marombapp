# Firestore Migration Tool: `(default)` → `marombapp` (#15, #23, ADR-004, ADR-005)

> **RETIRED after the 2026-11-16 cutover (#15). marombapp is authoritative. Any re-run needs a new PO decision.**

Historical one-off Node CLI (`firebase-admin`) that copied real MarombApp data from
`projects/vibe-cabral/databases/(default)` into `projects/vibe-cabral/databases/marombapp`
(`REQ-002`, `REQ-004`, `REQ-006`, `ADR-004`, `ADR-005`).

## Post-Cutover Retirement & Data-Loss Guardrails (`#23`, `ADR-005`)

1. **`--apply` is retired and refuses by default:** Following the `2026-11-16T00:20Z` cutover (`#15`),
   `marombapp` is the sole authoritative production database and already holds live PO edits and deletions
   absent from `(default)`. Running `--apply` is refused immediately unless authorized by a new PO decision,
   **and** the pre-apply guard passes.
2. **Pre-apply diff & divergence guard:** Even when an override is supplied, `evaluateTargetGuard()` inspects
   `marombapp` before any delete or write and aborts with exit code `1` (`0` deletes, `0` writes) if
   `marombapp` diverges from `(default)`:
   - any target-only `sessions` doc (`!source.has(docPath)`, unless listed in `--force-purge-target-sessions`), OR
   - any target-only `exercises` doc with `isCustom === true`, OR
   - any target-only `plans` doc that has `>= 1` `days` subcollection doc, OR
   - any in-place edit (`editedDocs`): a shared document whose fields, nested arrays, or `Timestamp` values
     differ between `(default)` and `marombapp`, OR
   - any post-migration deletion (`deletedDocs`): when `marombapp` already contains migrated documents, any
     `(default)` document path missing from `marombapp`.
3. **Read-only `--dry-run` diff reporting:** Running without `--apply` deletes nothing and writes nothing
   (`0` batches committed) while printing `Diff (edited in target)`, `Diff (deleted in target)`, and
   `GUARD WOULD BLOCK --apply` lines alongside collection counts.

## Safety Guarantees

1. **Read-only source in code:** `(default)` (never the empty named DB `default`) is wrapped in
   `createReadOnlySource()`, a frozen facade exposing only allowlisted `collection`, `listDocuments`, `doc`,
   and `get` calls (`0` write/delete/batch/`listCollections` methods).
2. **Strict collection allowlist:** Reads **only** `exercises`, `plans` (+ `plans/{planId}/days/{dayId}`),
   and `sessions`. Unrelated collections in `(default)` (`conversions`, `global_workouts`, `bookings`, etc.)
   and `eval_runs` in `marombapp` are never enumerated or touched.
3. **Target `(default)` / `default` refusal:** Both CLI parsing and `runCopyMigration()` reject `'(default)'`,
   `'default'`, empty strings, or any `Firestore` handle whose `databaseId` resolves to `(default)` or `default`.
4. **Dry-run by default:** Running without flags performs a strictly read-only comparison.

## Read-Only Inspection Usage (`--dry-run` only)

`--apply` is retired after the `2026-11-16` cutover (`#15`). Only read-only `--dry-run` comparison may be
executed without a new PO decision:

```bash
# Read-only inventory, edited/deleted diff report, and guard check (0 deletes, 0 writes)
node scripts/migrate/copy-default-to-marombapp.mjs --dry-run
```
