# Contracts

Contracts are the source of truth for the L2 contract checks that the evaluation team runs. Change a contract in the
same work item as the code that implements it.

## Contract files

- [`openapi.yaml`](openapi.yaml) — Cloud Run BFF HTTP contract covering `/api/healthz`, `/api/auth/session`, and the protected `/api/ai/*` boundary (`REQ-003`, `REQ-004`, `REQ-005`, `ADR-001`, `ADR-002`).

## Endpoints under contract

- `GET /api/healthz`
- `GET /api/auth/session`
- `POST /api/ai/*`

## Contract invariants

- Unauthenticated or non-ALLOWED_UID requests to protected /api/* routes return HTTP 401 or 403 with zero downstream Vertex AI calls.
- Firebase ID token audience verification resolves `FIREBASE_PROJECT_ID` with precedence over `GOOGLE_CLOUD_PROJECT` so Firebase Auth can remain in `vibe-cabral` while Cloud Run and Vertex AI run in `cabral-scion-hub` (`ADR-002`).
- GET /api/healthz returns strict JSON { status, revision, firestoreDatabase, aiReady } with HTTP 200.
- SPA fallback serves index.html for client routes (/analytics, /plan, /library, /in-gym, /start) without breaking /api/* 404/401 JSON responses.
