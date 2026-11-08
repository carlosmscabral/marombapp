# Live state

Only the deployer writes this file, after every deploy and every rollback. Other agents read it.

| Field | Value |
|---|---|
| Service | `marombapp-serving` (`https://marombapp-serving-280799742875.us-central1.run.app`) |
| Live revision | `marombapp-serving-00004-cjq` |
| Rollback revision | `marombapp-serving-00003-hts` |
| Source commit | `d95555facbbd97abc7b5b64858179687a5975958` (`d95555f`) |
| Applied migrations | `firestore:marombapp` (`firestore.rules` release `88e55196-5b7e-400a-927f-70777c7c9001` + composite index `sessions(status ASC, finishedAt DESC)` `CICAgOjXh4EK` `READY` in `vibe-cabral`) |
| Deployed at (UTC) | `2026-11-08T14:59:40Z` |
| Deployed by | deployer |

## History

| Deployed at (UTC) | Revision | Source | Work items |
|---|---|---|---|
| `2026-11-08T14:59:40Z` | `marombapp-serving-00004-cjq` (`vibe-cabral`) | `d95555f` | #12 |
| `2026-11-08T14:25:59Z` | `marombapp-serving-00003-hts` (`vibe-cabral`) | `5ceebae` | #6, #8, #11 |
| `2026-11-08T13:12:15Z` | `marombapp-serving-00002-rf6` (`vibe-cabral`) | `a446a59` | W1-04 (#5), #10 Part 2, #7 ([ADR-004](../adr/ADR-004-co-locate-hub-runtime-and-named-db-in-vibe-cabral.md) cutover to `vibe-cabral` with real Firebase web config + `firestore:marombapp` rules/indexes) |
| `2026-11-08T05:47:08Z` | `marombapp-serving-00003-4vq` (`cabral-scion-hub`) | `6f3d1ce` | W1-01 (#2), W1-04 (#5), #9 (Firebase init guard), #10 Part 1 (interim: sign-in pending PO #7) |
| `2026-11-08T04:30:24Z` | `marombapp-serving-00002-89c` (`cabral-scion-hub`) | `2f1f585` | W1-02 (#3), W1-03 (#4), W1-04 (#5 — interim: sign-in pending PO #7) |
