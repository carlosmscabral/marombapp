# Live state

Only the deployer writes this file, after every deploy and every rollback. Other agents read it.

| Field | Value |
|---|---|
| Service | `marombapp-serving` (`https://marombapp-serving-280799742875.us-central1.run.app`) |
| Live revision | `marombapp-serving-00011-tr2` |
| Rollback revision | `marombapp-serving-00010-zcx` |
| Source commit | `9a87baaf3ed33e12ff61d556885bc61761a6efdf` (`9a87baa`) |
| Applied migrations | `firestore:marombapp` (ruleset `88e55196-5b7e-400a-927f-70777c7c9001` + index `CICAgOjXh4EK` `READY`); `firestore:marombapp-test` (ruleset `81832c18-7dee-420c-b68d-33903eb5f578` + index `CICAgOjXh4EK` `READY` per [ADR-005](../adr/ADR-005-marombapp-db-is-production-marombapp-test-for-tests.md)) |
| Deployed at (UTC) | `2026-11-15T19:12:47Z` |
| Deployed by | deployer |

## History

| Deployed at (UTC) | Revision | Source | Work items |
|---|---|---|---|
| `2026-11-15T19:12:47Z` | `marombapp-serving-00011-tr2` (`vibe-cabral`) | `9a87baa` | #22 |
| `2026-11-15T17:58:36Z` | `marombapp-serving-00010-zcx` (`vibe-cabral`) | `8c8981b` | #20 |
| `2026-11-15T17:24:33Z` | `marombapp-serving-00009-vvr` (`vibe-cabral`) | `64f7cd6` | #21 |
| `2026-11-15T16:34:09Z` | `marombapp-serving-00008-m7h` (`vibe-cabral`) | `bfdd480` | #17, #19 |
| `2026-11-15T15:32:38Z` | `marombapp-serving-00007-nqd` (`vibe-cabral`) | `8d46610` | #16 |
| `2026-11-15T14:43:03Z` | `marombapp-serving-00006-5rz` (`vibe-cabral`) | `361a450` | #14 |
| `2026-11-15T13:26:01Z` | `marombapp-serving-00005-99q` (`vibe-cabral`) | `30e33c3` | #13 |
| `2026-11-08T14:59:40Z` | `marombapp-serving-00004-cjq` (`vibe-cabral`) | `d95555f` | #12 |
| `2026-11-08T14:25:59Z` | `marombapp-serving-00003-hts` (`vibe-cabral`) | `5ceebae` | #6, #8, #11 |
| `2026-11-08T13:12:15Z` | `marombapp-serving-00002-rf6` (`vibe-cabral`) | `a446a59` | W1-04 (#5), #10 Part 2, #7 ([ADR-004](../adr/ADR-004-co-locate-hub-runtime-and-named-db-in-vibe-cabral.md) cutover to `vibe-cabral` with real Firebase web config + `firestore:marombapp` rules/indexes) |
| `2026-11-08T05:47:08Z` | `marombapp-serving-00003-4vq` (`cabral-scion-hub`) | `6f3d1ce` | W1-01 (#2), W1-04 (#5), #9 (Firebase init guard), #10 Part 1 (interim: sign-in pending PO #7) |
| `2026-11-08T04:30:24Z` | `marombapp-serving-00002-89c` (`cabral-scion-hub`) | `2f1f585` | W1-02 (#3), W1-03 (#4), W1-04 (#5 — interim: sign-in pending PO #7) |
