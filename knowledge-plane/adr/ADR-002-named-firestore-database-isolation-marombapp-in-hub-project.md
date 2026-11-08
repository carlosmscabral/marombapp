# ADR-002: Named Firestore Database Isolation (`marombapp`) in Hub Project

- **Status:** Accepted
- **Requirements:** REQ-002, REQ-004
- **Work items:** —
- **Migrations:** —

## Context

Running automated E2E and blind evaluations against `vibe-cabral` `(default)` would pollute the owner's real personal workout history, while `(default)` in `cabral-scion-hub` already backs `cabral-links` and factory control-plane state.

## Decision

Parameterize Firestore initialization with `VITE_FIRESTORE_DATABASE_ID` and target a dedicated named Firestore Native database `marombapp` in `cabral-scion-hub` for factory builds and evaluations.

## Consequences

Guarantees zero cross-contamination with live personal workouts or sibling Hub projects while maintaining 1-line env promotion back to `vibe-cabral`.
