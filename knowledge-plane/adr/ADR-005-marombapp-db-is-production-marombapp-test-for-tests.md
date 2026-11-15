# ADR-005: DB `marombapp` Holds Real PO Data; DB `marombapp-test` Isolates Tests and Evaluation

- **Status:** Accepted
- **Requirements:** REQ-001, REQ-002, REQ-004
- **Work items:** #15 (PO decision, Option A)
- **Migrations:** `scripts/migrate/copy-default-to-marombapp.mjs` (one-off, re-runnable copy from `(default)`)
- **Supersedes:** — (amends ADR-004's use of `marombapp` as a shared test/eval database)

## Context

The PO wants the real data (exercises, plans, days, workout history) from the production app (`vibe-cabral.web.app`, Firestore `(default)`) in the new version. Until now DB `marombapp` also received live parity-test and blind-eval writes. Mixing those with real history would corrupt the PO's data (duplicate seeded exercises, extra active plans) and the evaluation evidence.

## Decision

- DB `marombapp` (vibe-cabral) is the **production data store** of the new version (`marombapp-serving`). It receives a strict-allowlist copy of `exercises`, `plans` (+ `days`) and `sessions` from `(default)`, made by the migration script. `eval_runs` stays where it is until the eval team moves it.
- DB `marombapp-test` (vibe-cabral, us-central1, Native; created by the PO 2026-11-15) receives **all** automated test, live-probe and blind-eval writes. Its rules/indexes match `marombapp`.
- `(default)` stays read-only for the factory. It is shared with other PO apps, and only the allowlisted MarombApp collections are ever read.
- Cutover: the PO stops writing in the old app, the copy runs once more, and the PO then uses the Cloud Run URL.

## Consequences

- Real history in the new app; tests and eval can no longer pollute it.
- Every probe/eval that writes must target `marombapp-test`. Reviewers reject any test or script that writes to `marombapp` or `(default)`, except the reviewed migration run.
- Until cutover, `(default)` keeps receiving the PO's new workouts; the re-runnable copy closes that gap.
