# Live Mobile PWA Ergonomics & `#22` Deterministic Seed IDs / Offline Empty-Library Audit — `marombapp-serving-00011-tr2` (`9a87baaf3ed3`)

- **Auditor:** `ui-auditor` (`marombapp-eval`)
- **Target Service:** `marombapp-serving` (`https://marombapp-serving-280799742875.us-central1.run.app` in `vibe-cabral`)
- **Live Revision:** `marombapp-serving-00011-tr2` (Rollback: `marombapp-serving-00010-zcx`; Source commit: `9a87baaf3ed33e12ff61d556885bc61761a6efdf` / `9a87baa`, shipping `#22` `eval-finding` fix in `src/lib/seed.ts` & `src/App.tsx`)
- **Audit Viewport:** `390x844` (`deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`, headless `/usr/bin/chromium`)
- **Audited At (UTC):** `2026-11-15T19:46:47Z` – `2026-11-15T19:47:21Z`
- **Cited Specifications:** `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`, `REQ-005`, `REQ-006`, `ADR-001`, `ADR-003`, `ADR-004`, `ADR-005`, `invariants.md` (Rules 1, 2, 3 & 4), Issues `#14`, `#19`, `#20`, `#21`, `#22`
- **Baseline Report:** `/scion-volumes/scratchpad/ui-audit-00010-zcx.md` (`marombapp-serving-00010-zcx` / `8c8981b8092d`)

---

## Executive Verdict: **PASS (Live `00011-tr2` PWA & `#22` Deterministic Seed IDs + Offline Empty-Library Guard Verified at `390x844`)**

1. **Live Unpatched `marombapp-serving-00011-tr2` Mobile PWA & Bundle Hygiene Audit (`REQ-001`–`REQ-005`, `ADR-001`, `ADR-003`, `ADR-004`, `ADR-005`, `#19`, `#20`, `#21`, `#22`):** **PASS**
   - All 7 SPA routes (`/`, `/plan`, `/library`, `/in-gym`, `/analytics`, `/start`, `/sessions/123`) return HTTP `200`, `<html lang="pt-BR">`, `pageErrors: []`, `unhandledRejections: []`, `scrollWidth === 390` (`0` overflowing elements), `hasInvalidApiKeyBanner: false`, `hasRawFirebaseError: false`, and `hasRefusingDatabaseError: false`.
   - PT-BR `<SignIn />` renders `"MarombApp"` (`14.69:1` WCAG AAA contrast), `"Entre para acompanhar seus treinos"` (`8.02:1` WCAG AAA contrast), and `"Entrar com Google"` (**`276px x 44px`** at `(57, 488)`, `6.07:1` WCAG AA contrast), opening the live `vibe-cabral` Google OAuth handler popup (`https://vibe-cabral.firebaseapp.com/__/auth/handler?...&authType=signInViaPopup`) on click with `0` `pageErrors`.
   - `GET /api/healthz` returns HTTP `200` `{"status":"ok","revision":"marombapp-serving-00011-tr2","firestoreDatabase":"marombapp","aiReady":true}`.
   - `/manifest.webmanifest` (`200 OK`, `430` B, `"lang": "pt-BR"`, `"description": "Diário pessoal de musculação"`), `/icons/icon-192.png` (`3,055` B), `/icons/icon-512.png` (`8,602` B), and `/sw.js` (`1,638` B, `activeState: "activated"`) pass; offline reloads (`context.setOffline(true)`) on `/`, `/plan`, and `/in-gym` resolve from the Service Worker (`fromServiceWorker: true`, `scrollWidth === 390`, `pageErrors: []`).
   - All 5 live JS chunks (`/assets/index-BtelBbMP.js` `358,905` B, `/assets/Analytics-jKk4h9Ri.js` `11,263` B, `/assets/charts-CyQaC5Dm.js` `392,265` B, `/assets/firebase-auth-5xDtBWTY.js` `213,031` B, `/assets/firebase-firestore-Dz6FGmGH.js` `348,067` B) contain **`0`** GCP secrets, **`0`** `@google/genai` / Vertex SDK imports, and **`0`** speculative AI UI strings, while compiling cleanly with `#19` `"marombapp"` `databaseId` + `(default)` refusal guard, `#21` `foldSearch` + `localizeFirebaseError`, and `#22` `getDocsFromServer` + `fromCache` check + deterministic slug helper `seedExerciseId`.
   - **Strict `ADR-004` & `ADR-005` Compliance:** **`0`** requests to `firestore.googleapis.com` (`firestoreRequestsObserved: []`) — zero reads or writes against `(default)`, `marombapp`, or `marombapp-test`.
2. **Focused `390x844` Interactive UI Audit of `#22` Deterministic Seeding & Offline Empty-Library Behavior (`dist-e2e` of `9a87baa` in `/tmp/ui-audit-9a87baa` — `REQ-001`, `REQ-002`, `REQ-004`, `REQ-006`, `ADR-005`, `#14`, `#20`, `#21`, `#22`):** **PASS (`6/6` layout states at `scrollWidth === 390`, `0` overflowing elements, `0` clipped controls, `0` `pageErrors`, `0` unhandled rejections, `0` Firebase/Firestore/GCP API calls)**
   - **Online First-Launch Deterministic Auto-Seed & Overload Linkage:** Authenticated boot with an empty store renders `"66 exercícios disponíveis"` on `/library` in strict `pt-BR` alphabetical order (`"Abdominal na Polia"` -> `"Tríceps Testa"`, `outOfOrder: []`). `localStorage` (`fake-fs:docs`) contains **`66` unique `exercises/<slug>` docs**, 100% matching `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` (e.g., `exercises/bench-press`, `exercises/overhead-press`, `exercises/farmers-walk`, `exercises/t-bar-row`, `exercises/bulgarian-split-squat`) with `isCustom: false`, remaining at **`66` docs (`0` duplicates)** across concurrent multi-tab `/library` open + reload. Seeded `"Supino Reto"` opens read-only in `ExerciseDetailSheet` (`0` `"Editar"`/`"Excluir"` buttons, `hasCustomBadge: false`). Picking `"Supino Reto"` (`bench-press`) and `"Desenvolvimento Militar"` (`overhead-press`) into a plan day, logging & finishing Workout #1 (`80×8`, `85×6`, note `"Pegada firme"`, `1.150 kg`), and starting Workout #2 renders `"Últimos treinos"` (`last-3` history) with `"80×8"`, `"85×6"`, `"Pegada firme"`, and pre-filled set inputs (`80×8`, `85×6`). Finishing Workout #2 (`82.5×8`, `87.5×6`, `1.185 kg`) links `"bench-press"` -> `"Supino Reto"` cleanly in `/analytics` (`2.335 kg` weekly volume + dual-axis Recharts `<LineChart>` with `4` data dots and `"Maior carga"` / `"Volume"` legends).
   - **Offline First-Launch Empty-Cache Guard (`#22`) & Reconnect Auto-Seed:** With Workbox `/sw.js` activated, `fake-fs:docs` cleared, and `context.setOffline(true)` enabled prior to first authenticated launch, `/library` loads from the Service Worker (`fromServiceWorker: true`) in **`425ms` (`0` stalls)**, rendering `"0 exercícios disponíveis"` and `"Nenhum exercício encontrado"` at `scrollWidth === 390` with **`0` `pageErrors`**, **`0` unhandled rejections**, and **`0` seed docs written while offline** (both on initial navigation and offline reload). Switching back online (`context.setOffline(false)`) and reloading populates `"66 exercícios disponíveis"` in `747ms` with **`66` unique deterministic slug docs (`0` duplicates)** across subsequent online reloads.
   - **L3 Module Size Invariant (`REQ-006`, `invariants.md` Rule 1):** All entrypoints (`src/main.tsx`: `15`, `src/App.tsx`: `80`, `server/index.ts`: `27` — all `<=200`) and `#22` touched/related modules (`src/lib/seed.ts`: `177`, `src/screens/Library.tsx`: `257`, `src/screens/library/ExerciseDetailSheet.tsx`: `162`, `src/screens/in-gym/ExerciseCard.tsx`: `213`, `src/screens/Analytics.tsx`: `289`, `src/screens/analytics/OverloadCard.tsx`: `190`, `tests/e2e/fakes/firebase-firestore.ts`: `170`, `tests/unit/seed.test.ts`: `269` — all `<=300`) comply strictly.

---

## 1. Live Unpatched `marombapp-serving-00011-tr2` Route & PWA Audit (`390x844`)

### 1.1 Unauthenticated SPA Route Matrix (`REQ-001`–`REQ-004`, `#19`, `#21`, `#22`)

| Route | HTTP Status | `<html lang>` | `pageErrors` | Raw Firebase / `invalid-api-key` | `#19` Refusal Error | Heading / Subtitle | CTA Button (`W x H`) | `scrollWidth` | Overflows | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/plan` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/library` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/in-gym` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/analytics` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/start` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/sessions/123` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |

### 1.2 Healthz, Offline Service Worker, OAuth Popup & Bundle Verification

- **`GET /api/healthz` (`ADR-001`, `ADR-004`, `ADR-005`):** HTTP `200` `{"status":"ok","revision":"marombapp-serving-00011-tr2","firestoreDatabase":"marombapp","aiReady":true}` (`PASS`).
- **Google OAuth Popup Check (`REQ-004`):** Clicking `"Entrar com Google"` (`276px x 44px`, `6.07:1` WCAG AA) opens `https://vibe-cabral.firebaseapp.com/__/auth/handler?apiKey=AIzaSy...&authType=signInViaPopup&redirectUrl=https%3A%2F%2Fmarombapp-serving-280799742875.us-central1.run.app%2F...` with `pageErrors: []` and `0` Firestore requests (`PASS`).
- **Offline PWA Reload (`REQ-002`, `REQ-003`):** `/manifest.webmanifest` (`200`, `430` B, `lang: "pt-BR"`), `/icons/icon-192.png` (`200`, `3,055` B), `/icons/icon-512.png` (`200`, `8,602` B), and `/sw.js` (`200`, `1,638` B, `activeState: "activated"`); `context.setOffline(true)` reloads on `/`, `/plan`, and `/in-gym` resolve from Service Worker (`fromServiceWorker: true`, `scrollWidth: 390`, `pageErrors: []`) (`PASS`).
- **Bundle Inspection (`/assets/index-BtelBbMP.js` `358,905` B vs `358,470` B in `00010-zcx`, `+435` B for `#22` server-authoritative seed guard; `/assets/firebase-firestore-Dz6FGmGH.js` `348,067` B):**
  - `hasGenAiSdk: false`, `hasPrivateKey: false`, `hasSpeculativeAiUi: false` across all 5 JS chunks (`ADR-003`, `invariants.md` Rules 2 & 3).
  - Confirmed production `databaseId` `"marombapp"` + `#19` `(default)` refusal guard (`hasIssue19DefaultRefusalGuard: true`), `#21` `foldSearch` + `localizeFirebaseError` (`hasIssue21FoldSearch: true`, `hasIssue21LocalizedErrors: true`), and `#22` compiled `seedExerciseId` (`n.trim().toLowerCase().replace(/['’]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")`), `withTimeout` (`Promise.race` + `.catch(()=>{})`), `getDocsFromServer(query(col, limit(1)))` (`"Failed to get documents from server"` in `/assets/firebase-firestore-Dz6FGmGH.js`), `d.metadata?.fromCache === !0` guard, fire-and-forget `m.commit().catch(()=>{})`, and in-flight deduplication (`PASS`).

---

## 2. `#22` Deterministic Seed IDs & Offline Empty-Library UI Audit (`390x844` — `dist-e2e` of `9a87baa`)

### 2.1 Layout, Overflow & Error Telemetry Across `#22` Online & Offline Flows

| # | Audited Interactive State (`390x844`) | `<html lang>` | `scrollWidth` (`<=390`) | Overflowing Elements | Clipped Controls | Key `#22` Telemetry | Result |
|---|---|---|---|---|---|---|---|
| 1 | `Library`: Online First-Launch Auto-Seed (`"66 exercícios disponíveis"`) | `pt-BR` | `390` | `0` | `0` | `66` unique ASCII slug IDs, `ptBrSorted: true`, `0` duplicates after multi-tab + reload | **PASS** |
| 2 | `ExerciseDetailSheet`: Seeded `"Supino Reto"` (`exercises/bench-press`) | `pt-BR` | `390` | `0` | `0` | Read-only (`editOrDeleteButtonCount: 0`, `hasCustomBadge: false`, `"Peito"` tag) | **PASS** |
| 3 | `InGym` Workout #2: `"Últimos treinos"` Linked by `"bench-press"` | `pt-BR` | `390` | `0` | `0` | Renders `"80×8"`, `"85×6"`, `"Pegada firme"`, pre-fills `80×8` & `85×6` | **PASS** |
| 4 | `Analytics`: `OverloadCard` Dual-Axis `LineChart` Linked by `"bench-press"` | `pt-BR` | `390` | `0` | `0` | `<select value="bench-press">` (`"Supino Reto"`), `2.335 kg` volume, `318x256` chart (`4` dots) | **PASS** |
| 5 | `Library`: Offline First-Launch Empty Store (`"0 exercícios disponíveis"`) | `pt-BR` | `390` | `0` | `0` | `fromServiceWorker: true`, rendered in `425ms` (`0` stalls), **`0` seed docs written offline** | **PASS** |
| 6 | `Library`: Online Reconnect + Reload (`"66 exercícios disponíveis"`) | `pt-BR` | `390` | `0` | `0` | Seeded in `747ms`, `66` unique deterministic slug docs (`0` duplicates across reloads) | **PASS** |

### 2.2 Detailed `#22` Invariant Measurements

1. **Deterministic Slug IDs & Multi-Tab Idempotency (`src/lib/seed.ts`, `src/App.tsx`):**
   - `storedExerciseCount === 66`, `uniqueExerciseIdCount === 66`, `allDeterministicAsciiSlugs === true` (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`), `allSeededMarkedNonCustom === true`.
   - Verified punctuation/spacing edge cases in `localStorage` (`fake-fs:docs`): `exercises/bench-press`, `exercises/overhead-press`, `exercises/farmers-walk` (`"Farmer's Walk"`), `exercises/t-bar-row` (`"T-Bar Row"`), `exercises/bulgarian-split-squat` (`"Bulgarian Split Squat"`).
   - Opening a concurrent second authenticated tab to `/library` and reloading preserved `countAfterMultiTabAndReload === 66` (`0` duplicate cards).
   - Rendered PT-BR alphabetical order verified across all `66` cards (`firstFivePtBrTitles`: `["Abdominal na Polia", "Abdominal Supra", "Agachamento Búlgaro", "Agachamento Frontal", "Agachamento Hack"]`; `lastFivePtBrTitles`: `["Terra Romeno (RDL)", "Tríceps Coice", "Tríceps Francês", "Tríceps Pulley", "Tríceps Testa"]`; `outOfOrder: []`).
   - Controls inspected on `/library`: Seeded `"Supino Reto"` card (`173px x 120px`, `14.69:1` AAA contrast), `"+ Adicionar"` (`125.4px x 32px`, `6.07:1` AA contrast, `REQ-002` as-is), `ExerciseDetailSheet` `"Fechar janela"` (`32px x 32px`, `8.02:1` AAA contrast, `REQ-002` as-is).
2. **Cross-Session Progressive Overload & Analytics Linkage (`REQ-001`, `#20`, `#22`):**
   - `PlanDay` stored deterministic `exerciseId`s `["bench-press", "overhead-press"]`.
   - Workout #1 (`80×8` + `85×6` = `1.150 kg`, note `"Pegada firme"`) -> Workout #2 (`InGym`) matched `historyMap.get("bench-press")` cleanly (`"Últimos treinos"` chips `"80×8"`, `"85×6"`, note `"Pegada firme"`, and pre-filled inputs `["80", "85", "85"]` × `["8", "6", "6"]`).
   - Workout #2 (`82.5×8` + `87.5×6` = `1.185 kg`) -> `/analytics` displayed `2` sessions this week, `2.335` kg total volume, `WeeklySplitCard` (`318x224` SVG), and `OverloadCard` (`<select value="bench-press">` -> `"Supino Reto"`, `318x256` Recharts `LineChart` with `4` plotted dots and `"Maior carga"` / `"Volume"` legends).
3. **Offline First-Launch Empty-Cache Guard (`#22`, `ADR-005`):**
   - With `navigator.onLine === false` (`context.setOffline(true)`) and empty `fake-fs:docs`, `/library` resolved from Workbox Service Worker (`offlineFromServiceWorker: true`, `offlineReloadFromServiceWorker: true`) in **`425ms`** (`0` 5-second UI stall), displaying `"0 exercícios disponíveis"`, `"Nenhum exercício encontrado"`, and `"Tente outro filtro ou adicione um exercício personalizado."` with `exerciseDocsWrittenWhileOffline === 0`, `offlineReloadSeedDocs === 0`, `pageErrorsTotal === 0`, and `unhandledRejectionsTotal === 0`.
   - Upon restoring connectivity (`context.setOffline(false)`) and reloading `/library`, `seedLibraryIfEmpty()` populated all `66` exercises in **`747ms`**, remaining at `66` unique deterministic slug documents (`0` duplicates) after a second online reload.

---

## 3. L3 Module Size & Safety Telemetry Summary (`REQ-004`–`REQ-006`, `ADR-004`, `ADR-005`)

- **Entrypoints (`<= 200` lines):** `src/main.tsx` (`15`), `src/App.tsx` (`80`), `server/index.ts` (`27`).
- **`#22` Touched & Related Modules (`<= 300` lines):** `src/lib/seed.ts` (`177`), `src/lib/db/library.ts` (`63`), `src/screens/Library.tsx` (`257`), `src/screens/library/ExerciseDetailSheet.tsx` (`162`), `src/screens/in-gym/ExerciseCard.tsx` (`213`), `src/screens/Analytics.tsx` (`289`), `src/screens/analytics/OverloadCard.tsx` (`190`), `tests/e2e/fakes/firebase-firestore.ts` (`170`), `tests/unit/seed.test.ts` (`269`).
- **Firestore & Network Isolation (`ADR-004`, `ADR-005`):**
  - Live `marombapp-serving-00011-tr2` audit: `firestoreRequestsObserved.length === 0`, `unhandledRejections.length === 0`.
  - Local `dist-e2e` `#22` audit: `0` requests to `firestore.googleapis.com`, `identitytoolkit.googleapis.com`, `firebaseio.com`, or `vibe-cabral` (only `fonts.googleapis.com` stylesheet requests when online), `pageErrorsTotal === 0`, `unhandledRejectionsTotal === 0`.
