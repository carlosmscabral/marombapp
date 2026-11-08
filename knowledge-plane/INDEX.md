# MarombApp knowledge plane

Read this index before you plan, implement, review, or deploy any work item. Open files through the paths in this
index; never guess a file name (L4). Cite requirement IDs (`REQ-NNN`) and decision IDs (`ADR-NNN`) in work items,
commits, reviews, and evaluation results.

## Where to look

| When you need to | Read |
|---|---|
| Know what to build and how it's accepted | [product/requirements.md](product/requirements.md) |
| Know why the system is built this way | [Decisions](#decisions) |
| Check an API or data contract | [contracts/README.md](contracts/README.md) |
| Review a change | [invariants.md](invariants.md) |
| Understand a domain term | [glossary.md](glossary.md) |
| Follow a project-specific procedure | [playbooks/README.md](playbooks/README.md) |
| Know what is live right now | [state/LIVE.md](state/LIVE.md) |
| Find the backlog | GitHub issues in `carlosmscabral/marombapp` (`status:*` labels) |

## Learned sources

These files existed in the repository before the factory started. They stay where they are; this index links to them.

- Guides: [`README.md`](../README.md)

## Decisions

| ADR | Title | Status | Requirements |
|---|---|---|---|
| [ADR-001](adr/ADR-001-unified-cloud-run-bff-static-pwa-serving.md) | Unified Cloud Run BFF + Static PWA Serving | Accepted | REQ-003, REQ-004, REQ-005 |
| [ADR-002](adr/ADR-002-named-firestore-database-isolation-marombapp-in-hub-project.md) | Named Firestore Database Isolation (`marombapp`) in Hub Project | Superseded by ADR-004 | REQ-002, REQ-004 |
| [ADR-003](adr/ADR-003-re-infrastructure-first-wave-scoping.md) | Re-Infrastructure First Wave Scoping | Accepted | REQ-001, REQ-002, REQ-005, REQ-006 |
| [ADR-004](adr/ADR-004-co-locate-hub-runtime-and-named-db-in-vibe-cabral.md) | Co-locate Scion Hub, Cloud Run and Named Firestore DB `marombapp` in `vibe-cabral` | Accepted | REQ-002, REQ-003, REQ-004 |

## Keep this knowledge plane healthy

- Run `python3 knowledge-plane/kp-check.py` after you change any file here. It fails on broken links and unknown
  `REQ-`/`ADR-` IDs.
- Add a decision with [adr/_template.md](adr/_template.md), and add a row to the table above.
- Don't put live state in this file. Only the deployer writes [state/LIVE.md](state/LIVE.md).
- Don't put evaluation golden datasets here. They belong to the evaluation team.
