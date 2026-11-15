# Live Mobile PWA Ergonomics & `#17` Optimistic Plan UI Audit — `marombapp-serving-00008-m7h` (`bfdd480d8c48`)

- **Auditor:** `ui-auditor` (`marombapp-eval`)
- **Target Service:** `marombapp-serving` (`https://marombapp-serving-280799742875.us-central1.run.app` in `vibe-cabral`)
- **Live Revision:** `marombapp-serving-00008-m7h` (Rollback: `marombapp-serving-00007-nqd`; Source commit: `bfdd480d8c481474741a211d4c7cbcea0847ff9d` / `bfdd480`, shipping `#17`, `#18`, `#19`)
- **Audit Viewport:** `390x844` (`deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`, headless `/usr/bin/chromium`)
- **Audited At (UTC):** `2026-11-15T17:02:41Z` – `2026-11-15T17:03:17Z`
- **Cited Specifications:** `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`, `REQ-005`, `REQ-006`, `ADR-001`, `ADR-003`, `ADR-004`, `ADR-005`, `invariants.md` (Rules 2, 3 & 4), Issues `#14`, `#17`, `#19`
- **Baseline Report:** `/scion-volumes/scratchpad/ui-audit-00007-nqd.md` (`marombapp-serving-00007-nqd` / `8d46610cf2e3`)

---

## Executive Verdict: **PASS (Live `00008-m7h` PWA, `#19` Production `marombapp` DB Guard & `#17` Optimistic Plan/PlanDay Flows Verified at `390x844`)**

1. **Live Unpatched `marombapp-serving-00008-m7h` Mobile PWA & `#19` Bundle Hygiene Audit (`REQ-001`–`REQ-005`, `ADR-001`, `ADR-003`, `ADR-004`, `ADR-005`, `#19`):** **PASS**
   - All 7 SPA routes (`/`, `/plan`, `/library`, `/in-gym`, `/analytics`, `/start`, `/sessions/123`) return HTTP `200`, `<html lang="pt-BR">`, `pageErrors: []`, `scrollWidth === 390` (`0` overflowing elements), `hasInvalidApiKeyBanner: false`, and `hasRefusingDatabaseError: false`.
   - PT-BR `<SignIn />` renders `"MarombApp"` (`14.69:1` WCAG AAA contrast), `"Entre para acompanhar seus treinos"` (`8.02:1` WCAG AAA contrast), and `"Entrar com Google"` (**`276px x 44px`** at `(57, 488)`, `6.07:1` WCAG AA contrast), opening the live `vibe-cabral` Google OAuth handler popup (`https://vibe-cabral.firebaseapp.com/__/auth/handler?...&authType=signInViaPopup`) on click with `0` `pageErrors`.
   - **`#19` Production Database Resolution & `(default)` Refusal Guard Verified in Live Bundle (`/assets/index-CtY80okJ.js`):**
     - Compiled helper signature in production bundle: `const I0="marombapp-test";function kp(n="marombapp"){...if(r==="(default)"||r==="default")throw new Error(\`Refusing Firestore database "${u}": (default) is legacy read-only (ADR-004, ADR-005). Use "marombapp" or "marombapp-test".\`);return u}kp();`
     - Confirms `marombapp-serving-00008-m7h` bakes in `"marombapp"` as the production database default (did **not** fall back to `"marombapp-test"` and did **not** fail Firebase initialization), while compiling in both the `"marombapp-test"` unset fallback and the explicit `(default)` refusal guard.
   - `GET /api/healthz` returns HTTP `200` `{"status":"ok","revision":"marombapp-serving-00008-m7h","firestoreDatabase":"marombapp","aiReady":true}`.
   - `/manifest.webmanifest` (`200 OK`, `430` B, `"lang": "pt-BR"`, `"description": "Diário pessoal de musculação"`), `/icons/icon-192.png` (`3,055` B), `/icons/icon-512.png` (`8,602` B), and `/sw.js` (`1,638` B, `activeState: "activated"`) pass; offline reloads (`context.setOffline(true)`) on `/`, `/plan`, and `/in-gym` resolve from the Service Worker (`fromServiceWorker: true`, `scrollWidth === 390`, `pageErrors: []`).
   - All 5 live JS chunks (`/assets/index-CtY80okJ.js` `352,940` B, `/assets/Analytics-tbNuENw_.js` `11,263` B, `/assets/charts-CyQaC5Dm.js` `392,265` B, `/assets/firebase-auth-5xDtBWTY.js` `213,031` B, `/assets/firebase-firestore-BeCyLZzN.js` `348,262` B) contain **`0`** GCP secrets, **`0`** `@google/genai` / Vertex SDK imports, and **`0`** speculative AI UI strings.
   - **Strict `ADR-004` & `ADR-005` Compliance:** **`0`** requests to `firestore.googleapis.com` (`firestoreRequestsObserved: []`) — zero reads or writes against `(default)`, `marombapp`, or `marombapp-test`.
2. **Focused `390x844` Interactive UI Audit of `#17` Optimistic Plan Flows & `#14` Deletion Regressions (`dist-e2e` of `bfdd480` in `/tmp/ui-audit-bfdd480` — `REQ-001`, `REQ-002`, `REQ-006`, `#14`, `#17`):** **PASS (`9/9` layout states at `scrollWidth === 390`, `0` overflowing/clipped controls, `11/11` audited controls `>=44x44px`, `0` `pageErrors`, `0` Firebase/GCP network calls)**
   - **Optimistic `setActivePlan` (`PlanDetailView` & `PlanListView`):** Clicking `"Definir como plano ativo"` (`175.8px x 66px`) on an inactive plan flips immediately to `"Plano ativo"` (`175.8px x 46px`, `7.42:1` AAA contrast) and mounts the `"Iniciar Treino"` FAB (`193.8px x 48px`) in one React commit without awaiting network `getDocs` or server ack; returning to `PlanListView` and toggling via `"Mais opções"` (`44x44px`) -> `"Definir como ativo"` (`174x44px`) updates the `"Ativo"` pill immediately with **zero double-`"Ativo"` badge glitch** (`maxSimultaneousActiveBadges === 1`) and survives full page reloads.
   - **Optimistic `addPlanDay` (`PlanDetailView` -> `PlanDay`):** Submitting `"Adicionar Dia"` (`"Cancelar"` `85.8x44px`, `"Adicionar"` `93.5x44px`) generates a client-side 20-char day ID (`plans/p-ppl/days/1oWPAvkfEAzWnHF9Fjth`, `order: 1`), pushes an optimistic day entry, and navigates immediately into `PlanDay` with `<input value="Inferior Completo">` already populated on first paint (`emptyDayTitleFlashObserved: false`), `"0 exercícios"`, and `"Excluir dia de treino"` (`238.4px x 44px`, `inInitialViewport: true`). Adding 2 exercises via `ExercisePickerModal`, navigating back (`["Empurrar A" (1 exercício), "Inferior Completo" (2 exercícios)]`), and reloading `/plan` preserves exact day order and exercise counts.
   - **`#14` Deletion Regression Check After Optimistic Toggles:** Deleting a newly created optimistic day (`"Dia Engano"`) from `PlanDay`, deleting an inactive plan from `PlanListView` right after active-plan switches, and deleting the active plan from `PlanDetailView` all prompt with named PT-BR `confirm()` dialogs, update the UI immediately without stalling, and cleanly transition `/plan` (`"Você ainda não tem nenhum plano."`), `/in-gym` (`"Nenhum treino ativo"`), and `/start` (`"Nenhum plano ativo"` + `"Ir para planos"` `198.5x44px`), surviving reload.
   - **L3 Module Size Invariant (`REQ-006`):** All `#17`/`#19` touched/extracted modules remain strictly `<= 300` lines (`firebase.ts`: `99`, `db/plans.ts`: `290`, `Plan.tsx`: `77`, `PlanListView.tsx`: `167`, `PlanRow.tsx`: `186`, `PlanDetailView.tsx`: `286`, `DayRow.tsx`: `138`, `PlanDay.tsx`: `256`).

---

## 1. Live Unpatched `marombapp-serving-00008-m7h` Route & PWA Audit (`390x844`)

### 1.1 Unauthenticated SPA Route Matrix (`REQ-001`–`REQ-004`, `#19`)

| Route | HTTP Status | `<html lang>` | `pageErrors` | `auth/invalid-api-key` | `#19` Refusal Error | Heading / Subtitle | CTA Button (`W x H`) | `scrollWidth` | Overflows | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/plan` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/library` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/in-gym` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/analytics` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/start` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/sessions/123` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |

### 1.2 Healthz, Offline Service Worker, OAuth Popup & `#19` Bundle Verification

- **`GET /api/healthz` (`ADR-001`, `ADR-004`, `ADR-005`):** HTTP `200` `{"status":"ok","revision":"marombapp-serving-00008-m7h","firestoreDatabase":"marombapp","aiReady":true}` (`PASS`).
- **Google OAuth Popup Check (`REQ-004`):** Clicking `"Entrar com Google"` (`276px x 44px`, `6.07:1` WCAG AA) opens `https://vibe-cabral.firebaseapp.com/__/auth/handler?apiKey=AIzaSy...&authType=signInViaPopup&redirectUrl=https%3A%2F%2Fmarombapp-serving-280799742875.us-central1.run.app%2F...` with `pageErrors: []` and `0` Firestore requests (`PASS`).
- **Offline PWA Reload (`REQ-003`):** `/manifest.webmanifest` (`200`, `lang: "pt-BR"`), `/icons/icon-192.png` (`200`), `/icons/icon-512.png` (`200`), and `/sw.js` (`200`, `activeState: "activated"`); `context.setOffline(true)` reload on `/`, `/plan`, and `/in-gym` served from Service Worker (`fromServiceWorker: true`, `scrollWidth: 390`, `pageErrors: []`) (`PASS`).
- **Bundle Inspection (`/assets/index-CtY80okJ.js` `352,940` B vs `351,286` B in `00007-nqd`, `+1.65 KB` for `#17` optimistic state + `#19` DB guard):**
  - `hasGenAiSdk: false`, `hasPrivateKey: false`, `hasSpeculativeAiUi: false`.
  - Confirmed `#19` `resolveFirestoreDatabaseId` compiled with production default `"marombapp"`, unset fallback `"marombapp-test"`, and `(default)` throw guard (`PASS`).

---

## 2. `#17` Optimistic Plan/PlanDay Ergonomics & `#14` Regression Audit (`390x844` — `dist-e2e` of `bfdd480`)

### 2.1 Layout & Overflow Verification Across Optimistic Transitions

| # | Audited Interactive State (`390x844`) | `<html lang>` | `scrollWidth` (`<=390`) | Overflowing Elements | Clipped Controls | Result |
|---|---|---|---|---|---|---|
| 1 | `PlanListView`: Initial (`"PPL Hipertrofia"` active, `"Bloco Força 4 Dias"` inactive) | `pt-BR` | `390` | `0` | `0` | **PASS** |
| 2 | `PlanDetailView`: Inactive plan before activation (`"Definir como plano ativo"` + `"Excluir plano"`, `0` FAB) | `pt-BR` | `390` | `0` | `0` | **PASS** |
| 3 | `PlanDetailView`: Immediately after optimistic `"Definir como plano ativo"` (`"Plano ativo"` + `"Iniciar Treino"` FAB) | `pt-BR` | `390` | `0` | `0` | **PASS** |
| 4 | `PlanListView`: Immediately after `"Mais opções"` -> `"Definir como ativo"` (`1` `"Ativo"` badge, zero double-badge flash) | `pt-BR` | `390` | `0` | `0` | **PASS** |
| 5 | `PlanDay`: Immediately after optimistic `addPlanDay` (`"Inferior Completo"`, `"0 exercícios"`, `"Excluir dia de treino"`) | `pt-BR` | `390` | `0` | `0` | **PASS** |
| 6 | `PlanDay`: Optimistic new day populated with 2 exercises via `ExercisePickerModal` (`"2 exercícios"`) | `pt-BR` | `390` | `0` | `0` | **PASS** |
| 7 | `PlanListView`: Empty state (`"Você ainda não tem nenhum plano."`) immediately after deleting active plan | `pt-BR` | `390` | `0` | `0` | **PASS** |
| 8 | `InGym` (`/in-gym`): `"Nenhum treino ativo"` after active plan deletion | `pt-BR` | `390` | `0` | `0` | **PASS** |
| 9 | `StartWorkout` (`/start`): `"Nenhum plano ativo"` + `"Ir para planos"` after active plan deletion & reload | `pt-BR` | `390` | `0` | `0` | **PASS** |

### 2.2 Touch-Target Geometry (`>=44x44px`) & WCAG Contrast Matrix

| Screen / Surface | Control | Bounding Box (`W x H` @ `x, y`) | `>=44x44` | Initial Viewport | Clipped | Contrast (WCAG 2.1) | Result |
|---|---|---|---|---|---|---|---|
| `PlanDetailView` (Inactive) | `"Definir como plano ativo"` | **`175.8 x 66`** @ `(16, 160)` | `true` | `true` | `false` | **`14.69:1`** (AAA) | **PASS** |
| `PlanDetailView` (Inactive / Active) | `"Excluir plano"` | **`174.3 x 44`** @ `(199.8, 171)` | `true` | `true` | `false` | **`6.02:1`** (AA) | **PASS** |
| `PlanDetailView` (Optimistic Active) | `"Plano ativo"` | **`175.8 x 46`** @ `(16, 160)` | `true` | `true` | `false` | **`7.42:1`** (AAA) | **PASS** |
| `PlanDetailView` (Optimistic Active) | `"Iniciar Treino"` FAB | **`193.8 x 48`** @ `(98.1, 700)` | `true` | `true` | `false` | **`7.94:1–9.51:1`** (AAA gradient) | **PASS** |
| `PlanListView` (`PlanRow`) | `"Mais opções"` (`⋮`) | **`44 x 44`** @ `(314, 357)` | `true` | `true` | `false` | **`8.02:1`** (AAA icon) | **PASS** |
| `PlanListView` (`PlanRow` menu) | `"Definir como ativo"` | **`174 x 44`** @ `(183, 406)` | `true` | `true` | `false` | **`12.97:1`** (AAA) | **PASS** |
| `PlanDetailView` (`AddDayRow`) | `"Adicionar Dia"` trigger | **`358 x 50`** @ `(16, 378)` | `true` | `true` | `false` | **`6.81:1`** (AA) | **PASS** |
| `PlanDetailView` (`AddDayRow` open) | `"Cancelar"` / `"Adicionar"` | **`85.8 x 44`** / **`93.5 x 44`** @ `y=390` | `true` | `true` | `false` | **`7.08:1`** / **`6.07:1`** | **PASS** |
| `PlanDay` (Optimistic new day) | `"Excluir dia de treino"` | **`238.4 x 44`** @ `(135.6, 160)` | `true` | `true` | `false` | **`6.02:1`** (AA) | **PASS** |
| `PlanDay` (Header) | `"Voltar"` (`ArrowLeft`) | **`44 x 44`** @ `(16, 90)` | `true` | `true` | `false` | **`8.33:1`** (AAA icon) | **PASS** |
| `StartWorkout` (No active plan) | `"Ir para planos"` link | **`198.5 x 44`** @ `(95.8, 320)` | `true` | `true` | `false` | **`6.07:1`** (AA) | **PASS** |

### 2.3 Detailed Behavioral Findings (`#17` & `#14`)

1. **`setActivePlan` Optimistic Transitions (`PlanDetailView` & `PlanListView`):**
   - On `PlanDetailView`, `fabBeforeActivate === 0`; clicking `"Definir como plano ativo"` synchronously updates `isActive` (`plan.active || optimisticActive`) and propagates `onActivatePlan(plan.id)` up to `Plan.tsx`, rendering `"Plano ativo"` and the `"Iniciar Treino"` FAB immediately (`120ms` total Playwright click + visibility assertion round-trip) without waiting on network `getDocs` or `batch.commit()`.
   - Navigating back to `PlanListView` shows `"Ativo"` exclusively on `"Bloco Força 4 Dias"` (`hasActiveBadge: true`) and `false` on `"PPL Hipertrofia"`, surviving full `page.reload()`.
   - On `PlanListView`, clicking `"Mais opções"` -> `"Definir como ativo"` on `"PPL Hipertrofia"` flips the `"Ativo"` badge immediately (`92ms` round-trip), hides `"Definir como ativo"` when re-opening `"Mais opções"` on the active plan (`setActiveHiddenWhenActive: true`), exhibits `maxSimultaneousActiveBadges === 1` (zero dual-badge flash), and survives `page.reload()`.
2. **`addPlanDay` Optimistic Client-ID Navigation & Persistence:**
   - Submitting `"Inferior Completo"` via `AddDayRow` creates client-generated path `plans/p-ppl/days/1oWPAvkfEAzWnHF9Fjth` (`order: 1`) via `doc(daysCol(planId))` + non-blocking `setDoc`, appends `{ id, name: "Inferior Completo", order: 1, exercises: [] }` to `optimisticDays`, and calls `onSelectDay(id)` in the same batch (`120ms` round-trip).
   - `<PlanDay />` mounts on first paint with `renderedDayTitle === "Inferior Completo"` (`emptyDayTitleFlashObserved: false`), `"0 exercícios"`, and `"Excluir dia de treino"` (`238.4x44` @ `y=160`).
   - Picking `"Supino Inclinado com Halteres"` and `"Levantamento Terra Sumô"` updates the count to `"2 exercícios"`, returning to `PlanDetailView` lists `["Empurrar A" ("1 exercício"), "Inferior Completo" ("2 exercícios")]` in ascending order, and `page.reload()` preserves the exact order and exercise counts.
3. **`#14` Deletion Regressions After Optimistic State Changes:**
   - Creating `"Dia Engano"` and immediately clicking `"Excluir dia de treino"` prompts `'Excluir o dia de treino "Dia Engano"?'`, calls `onDeleted()` to record `deletedDayIds` on `PlanDetailView`, and returns immediately to `"2 dias"` (`mistakenDayGoneImmediately: true`).
   - Rapidly toggling active plans on `PlanListView` and deleting inactive `"Bloco Força 4 Dias"` prompts `'Excluir o plano "Bloco Força 4 Dias"? Esta ação não pode ser desfeita.'` and removes the row immediately.
   - Opening active `"PPL Hipertrofia"` and clicking `"Excluir plano"` prompts `'Excluir o plano "PPL Hipertrofia"? Esta ação não pode ser desfeita.'`, registers `pendingDeletedPlans` so `subscribeActivePlan` / `subscribeAllPlans` immediately filter it out, renders `"Você ainda não tem nenhum plano."` on `/plan`, `"Nenhum treino ativo"` on `/in-gym`, and `"Nenhum plano ativo"` on `/start` (persisting across `page.reload()`).
