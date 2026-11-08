# ADR-004: Co-locate Scion Hub, Cloud Run and Named Firestore DB `marombapp` in `vibe-cabral`

- **Status:** Accepted
- **Requirements:** REQ-002, REQ-003, REQ-004
- **Work items:** #7 (PO decision), #10 Part 2, #5 (W1-04)
- **Migrations:** —
- **Supersedes:** ADR-002 (project placement only; the named-database isolation rule stays)

## Context

ADR-002 placed the factory runtime and the named Firestore database `marombapp` in `cabral-scion-hub`, while Firebase Auth stayed in `vibe-cabral`. That split blocked real sign-in and the rules/index deploy (PO decision #7). The PO answered on #7: create a new small-footprint VM-only Scion Hub in `vibe-cabral`, keep the app architecture (Cloud Run + Firestore), use the existing `vibe-cabral` Firebase Auth, and remove all `marombapp` resources from `cabral-scion-hub` after the new environment passes L1/L2.

## Decision

- The Scion Hub VM `scion-hub-vibe`, the Cloud Run service `marombapp-serving` (`us-central1`, `https://marombapp-serving-280799742875.us-central1.run.app`) and the named Firestore Native database `marombapp` (`projects/vibe-cabral/databases/marombapp`) all live in project `vibe-cabral`.
- Firebase Auth is the existing `vibe-cabral` Auth. `ALLOWED_UID=iELlq0wRQhR2F5NmrM6pbMSrJuj1` is the same in `firestore.rules`, Cloud Run `ALLOWED_UID` and the Vite build args.
- The app and the factory control plane use only database `marombapp`. Rules, indexes, E2E and eval writes MUST NOT target `(default)`, which holds the owner's live workout history.
- Firebase Hosting (`vibe-cabral.web.app`) is untouched. Factory commands deploy only `firestore:marombapp` with an explicit `--project vibe-cabral`; they never run a bare `firebase deploy`.
- Identities: runtime `marombapp-run@vibe-cabral`, deployer `marombapp-deployer@vibe-cabral`, Cloud Build `vibe-builder@vibe-cabral` (pass it explicitly as the build service account).
- After the `vibe-cabral` service passes L1/L2, the operator removes every `marombapp` resource from `cabral-scion-hub`.

## Consequences

- Auth, Firestore and Cloud Run share one project, so token audience (`FIREBASE_PROJECT_ID=GOOGLE_CLOUD_PROJECT=vibe-cabral`) and rules UID line up. This unblocks real sign-in and #10 Part 2.
- The blast radius moves next to live personal data. Watch for any command without `database: marombapp` or `--database=marombapp`; reviewers reject it.
- The `.firebaserc` `hub` alias and the `cabral-scion-hub` references in playbooks become stale and get removed.
