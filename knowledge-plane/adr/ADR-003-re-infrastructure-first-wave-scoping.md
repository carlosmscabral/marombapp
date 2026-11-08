# ADR-003: Re-Infrastructure First Wave Scoping

- **Status:** Accepted
- **Requirements:** REQ-001, REQ-002, REQ-005, REQ-006
- **Work items:** —
- **Migrations:** —

## Context

The codebase currently has 0 tests and 400–827 line monolithic screen files; layering AI generation and evaluation simultaneously would mix refactoring churn with product design.

## Decision

Scope Wave 1 strictly to deterministic parity tests, <=300-line modularization, and Cloud Run/Auth/Vertex plumbing with 100% as-is UX parity, deferring all AI features to manual PO GitHub issues.

## Consequences

Gives the PO a clean, verified architectural baseline and lets each subsequent AI capability be specified and evaluated one issue at a time.
