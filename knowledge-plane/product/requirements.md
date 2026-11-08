# Requirements

Mission: Modernize MarombApp into a modular, fully tested, Cloud Run + Firestore + Vertex AI-ready architecture with 100% as-is functional parity so AI workout creation and evaluation features can be added incrementally via PO-authored issues.

Non-goals:

- Do not implement end-user AI workout generation or evaluation UI/features during initial bootstrap (prepare the BFF/auth/Vertex foundation only; AI features arrive later via manual PO GitHub issues).
- Do not alter current as-is user flows, visual design, or workout/rest-timer behavior during architectural refactoring.
- Do not build open multi-tenancy, public profiles, social feeds, native mobile apps, nutrition tracking, or provisioned SQL databases.

Each requirement has a stable ID. Never renumber an ID; mark it `Withdrawn` instead.

## REQ-001: Deterministic As-Is Parity Test Suite



### Acceptance criteria

- [ ] `npm test` runs headless Vitest unit/component tests and 390x844 Playwright mobile E2E specs in CI/container without touching production `vibe-cabral` data.
- [ ] Covers single-UID auth gate, 66-exercise seed + custom Library CRUD, Plan and PlanDay ordering/targets, active InGym set logging, reload-persistent sticky top `RestBar` count-up clock, last-3-executions progressive overload display, Analytics charts, and SessionDetail.

### Work items

- W1-01: Establish Vitest + 390x844 Playwright as-is parity test suite
- W1-04: Containerize, deploy Release 1 to Cloud Run `marombapp-serving`, and promote `LIVE.md`

## REQ-002: 100% As-Is Functional Parity and Offline PWA Resilience



### Acceptance criteria

- [ ] Preserves existing mobile-first visual layout, routing, Firestore `persistentLocalCache` + `persistentMultipleTabManager`, and Workbox PWA manifest/service worker behavior with zero regressions.
- [ ] Adds zero unrequested end-user AI screens or UI changes during Wave 1 bootstrap.

### Work items

- W1-01: Establish Vitest + 390x844 Playwright as-is parity test suite
- W1-02: Add multi-DB Firestore config, typed BFF apiClient, and automated <=300-line / STE100 architecture guardrails

## REQ-003: Thin Cloud Run BFF and SPA Static Serving



### Acceptance criteria

- [ ] TypeScript BFF serves compiled `dist/` assets with SPA route fallback (`/analytics`, `/plan`, `/library`, `/in-gym`, `/start`, `/sessions/:id`) and exposes `GET /api/healthz` returning HTTP 200 JSON.
- [ ] Runs cleanly on Cloud Run `marombapp-serving` (`port: 8080`) under least-privilege `marombapp-run@cabral-scion-hub.iam.gserviceaccount.com`.

### Work items

- W1-03: Build thin Cloud Run BFF with Firebase ALLOWED_UID auth and Vertex AI readiness plumbing
- W1-04: Containerize, deploy Release 1 to Cloud Run `marombapp-serving`, and promote `LIVE.md`

## REQ-004: Single-UID Auth Guard (`ALLOWED_UID`) and Isolated Firestore Environment



### Acceptance criteria

- [ ] Protected `/api/*` routes verify Firebase ID tokens and reject missing, invalid, or non-`ALLOWED_UID` callers with HTTP 401/403 and zero downstream Vertex AI calls.
- [ ] `firestore.rules` enforces single-UID access and frontend/BFF support configurable `VITE_FIRESTORE_DATABASE_ID` (`marombapp` in `cabral-scion-hub` vs `(default)` in `vibe-cabral`).

### Work items

- W1-02: Add multi-DB Firestore config, typed BFF apiClient, and automated <=300-line / STE100 architecture guardrails
- W1-03: Build thin Cloud Run BFF with Firebase ALLOWED_UID auth and Vertex AI readiness plumbing
- W1-04: Containerize, deploy Release 1 to Cloud Run `marombapp-serving`, and promote `LIVE.md`

## REQ-005: Dormant AI-Ready Server and Client Plumbings



### Acceptance criteria

- [ ] BFF provides a lazy-initialized Vertex AI Gemini adapter (`GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION=global`) and `/api/ai` router boundary ready for future PO-authored issues.
- [ ] Frontend provides a typed `apiClient` module that attaches the authenticated Firebase ID token, with zero GCP or Vertex AI keys bundled into client assets.

### Work items

- W1-02: Add multi-DB Firestore config, typed BFF apiClient, and automated <=300-line / STE100 architecture guardrails
- W1-03: Build thin Cloud Run BFF with Firebase ALLOWED_UID auth and Vertex AI readiness plumbing

## REQ-006: Modular Anti-Monolith Architecture and ASD-STE100 Documentation



### Acceptance criteria

- [ ] Entrypoints (`src/main.tsx`, `src/App.tsx`, `server/index.ts`) remain `<=200` lines and all modules/screens remain `<=300` lines with strict acyclic imports and lazy I/O.
- [ ] Every created or edited module, component, handler, and non-trivial function carries Why-focused ASD-STE100 docstrings/comments (active voice, short sentences, condition-first, zero `;` in prose).

### Work items

- W1-02: Add multi-DB Firestore config, typed BFF apiClient, and automated <=300-line / STE100 architecture guardrails
- W1-03: Build thin Cloud Run BFF with Firebase ALLOWED_UID auth and Vertex AI readiness plumbing
