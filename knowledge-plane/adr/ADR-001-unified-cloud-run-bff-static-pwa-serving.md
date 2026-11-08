# ADR-001: Unified Cloud Run BFF + Static PWA Serving

- **Status:** Accepted
- **Requirements:** REQ-003, REQ-004, REQ-005
- **Work items:** —
- **Migrations:** —

## Context

MarombApp needs authenticated Vertex AI Gemini capabilities in upcoming waves without exposing API keys in the browser or overwriting live Firebase Hosting on vibe-cabral.web.app.

## Decision

Serve static Vite PWA assets and authenticated `/api/*` endpoints from a single Node/TypeScript Cloud Run service (`marombapp-serving`) running as `marombapp-run@cabral-scion-hub.iam.gserviceaccount.com`.

## Consequences

Eliminates CORS complexity, keeps Vertex AI credentials strictly server-side via IAM, and isolates factory deployments from production Firebase Hosting.
