# Live Mobile PWA Ergonomics & `#20` Optimistic Library, Plan & In-Gym Lifecycle Audit — `marombapp-serving-00010-zcx` (`8c8981b8092d`)

- **Auditor:** `ui-auditor` (`marombapp-eval`)
- **Target Service:** `marombapp-serving` (`https://marombapp-serving-280799742875.us-central1.run.app` in `vibe-cabral`)
- **Live Revision:** `marombapp-serving-00010-zcx` (Rollback: `marombapp-serving-00009-vvr`; Source commit: `8c8981b8092da836b9a6ca0b87e6932a7b7f3d02` / `8c8981b`, shipping `#20` offline-resilient optimistic mutations and cache-first reads across `library`, `plans`, and `sessions`)
- **Audit Viewport:** `390x844` (`deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`, headless `/usr/bin/chromium`)
- **Audited At (UTC):** `2026-11-15T18:21:45Z` – `2026-11-15T18:26:03Z`
- **Cited Specifications:** `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`, `REQ-005`, `REQ-006`, `ADR-001`, `ADR-003`, `ADR-004`, `ADR-005`, `invariants.md` (Rules 1, 2, 3 & 4), Issues `#14`, `#17`, `#19`, `#20`, `#21`
- **Baseline Report:** `/scion-volumes/scratchpad/ui-audit-00009-vvr.md` (`marombapp-serving-00009-vvr` / `64f7cd6a37ed`)

---

## Executive Verdict: **PASS (Live `00010-zcx` PWA & `#20` Optimistic Library, Plan, and In-Gym Active Workout Lifecycle Verified at `390x844`)**

1. **Live Unpatched `marombapp-serving-00010-zcx` Mobile PWA & Bundle Hygiene Audit (`REQ-001`–`REQ-005`, `ADR-001`, `ADR-003`, `ADR-004`, `ADR-005`, `#19`, `#20`, `#21`):** **PASS**
   - All 7 SPA routes (`/`, `/plan`, `/library`, `/in-gym`, `/analytics`, `/start`, `/sessions/123`) return HTTP `200`, `<html lang="pt-BR">`, `pageErrors: []`, `scrollWidth === 390` (`0` overflowing elements), `hasInvalidApiKeyBanner: false`, `hasRawFirebaseError: false`, and `hasRefusingDatabaseError: false`.
   - PT-BR `<SignIn />` renders `"MarombApp"` (`14.69:1` WCAG AAA contrast), `"Entre para acompanhar seus treinos"` (`8.02:1` WCAG AAA contrast), and `"Entrar com Google"` (**`276px x 44px`** at `(57, 488)`, `6.07:1` WCAG AA contrast), opening the live `vibe-cabral` Google OAuth handler popup (`https://vibe-cabral.firebaseapp.com/__/auth/handler?...&authType=signInViaPopup`) on click with `0` `pageErrors`.
   - `GET /api/healthz` returns HTTP `200` `{"status":"ok","revision":"marombapp-serving-00010-zcx","firestoreDatabase":"marombapp","aiReady":true}`.
   - `/manifest.webmanifest` (`200 OK`, `430` B, `"lang": "pt-BR"`, `"description": "Diário pessoal de musculação"`), `/icons/icon-192.png` (`3,055` B), `/icons/icon-512.png` (`8,602` B), and `/sw.js` (`1,638` B, `activeState: "activated"`) pass; offline reloads (`context.setOffline(true)`) on `/`, `/plan`, and `/in-gym` resolve from the Service Worker (`fromServiceWorker: true`, `scrollWidth === 390`, `pageErrors: []`).
   - All 5 live JS chunks (`/assets/index-BMwUF882.js` `358,470` B, `/assets/Analytics-OOmDxfPv.js` `11,263` B, `/assets/charts-CyQaC5Dm.js` `392,265` B, `/assets/firebase-auth-5xDtBWTY.js` `213,031` B, `/assets/firebase-firestore-DAsxmVLR.js` `348,062` B) contain **`0`** GCP secrets, **`0`** `@google/genai` / Vertex SDK imports, and **`0`** speculative AI UI strings, while preserving the `#19` production `"marombapp"` `databaseId` default + `(default)` refusal guard and `#21` `foldSearch` + `localizeFirebaseError`.
   - **Strict `ADR-004` & `ADR-005` Compliance:** **`0`** requests to `firestore.googleapis.com` (`firestoreRequestsObserved: []`) — zero reads or writes against `(default)`, `marombapp`, or `marombapp-test`.
2. **Focused `390x844` Interactive UI, Optimistic Transition & Reload Audit of `#20` Flows (`dist-e2e` of `8c8981b` in `/tmp/ui-audit-8c8981b` — `REQ-001`, `REQ-002`, `REQ-006`, `#14`, `#17`, `#20`, `#21`):** **PASS (`14/14` layout states at `scrollWidth === 390`, `0` overflowing elements, `0` clipped controls, `0` empty/stale/not-found flashes across DOM `MutationObserver` telemetry, `0` unhandled rejections, `0` `pageErrors`, `0` Firebase/GCP network calls)**
   - **Library Optimistic CRUD (`createExercise`, `updateExercise`, `deleteExercise`):** Creating custom `"Agachamento Búlgaro Isométrico"` closes `ExerciseFormSheet` immediately (`94ms`), updates count to `"67 exercícios disponíveis"`, and matches `#21` unaccented `'agachamento bulgaro isometrico'`. Editing to `"Remada Curvada Unilateral"` (`Costas · Dorsais`) updates immediately with **`0` stale-title flash** (`staleLibraryNameAfterEditObserved: false`); deleting via 2-step confirmation (`"Excluir"` `176x44px` -> `"Confirmar"` `162x44px`) closes `ExerciseDetailSheet` (`66ms`) and drops back to `"66 exercícios disponíveis"`; all changes survive `/library` reloads.
   - **Plan Optimistic CRUD (`createPlan`, `renamePlan`, `reorderPlanDays`, `archivePlan`):** Creating `"Ciclo Força Inicial"` transitions immediately (`72ms`) into `PlanDetailView` with populated title `"Ciclo Força Inicial"` (`emptyPlanTitleFlashObserved: false` across `17` DOM checks) and `"Plano ativo"`. Adding 2 days and tapping `"Mover para baixo"` swaps immediately to `["Dia B - Puxar", "Dia A - Empurrar"]` with **`0` snap-back** (`dayOrderSnapBackObserved: false`). Both `PlanDetailView` header rename (`"Ciclo Hipertrofia Avançado"`) and `PlanRow` inline `"Renomear"` (`"Plano Deload Semana 5"`) update immediately, `"Arquivar"` hides the inactive plan in `56ms`, and `/plan` reload preserves the active plan, archived filter, and reordered days.
   - **In-Gym Active Workout Optimistic Lifecycle (`createSession`, `finishSession`, `abandonSession`, cache-first `getSession`):** Tapping `"Dia A - Empurrar"` (`358x112px`) on `/start` navigates immediately (`175ms`) to `/in-gym` with client-generated 20-char session ID `sessions/UYrRFglS7MCChCF7uNNG` and populated cards (`"Supino Reto"`, `"Desenvolvimento Militar"`) with **`0` `"Nenhum treino ativo"` flash** (`emptyInGymFlashDuringCreateObserved: false`). Logging 2 sets (`80x8` + `82.5x6`), starting sticky `RestBar` (`maromba.restTimer`), and reloading `/in-gym` preserves `2` completed sets, session notes (`"Ótima energia hoje"`), and the running rest clock (`restTimerRunningAfterReload: true`). Tapping `"Finalizar treino"` (`358x60px`) navigates immediately (`260ms`) to `/sessions/UYrRFglS7MCChCF7uNNG`, rendering `"Treino concluído"`, `1.135 kg` volume, and `2 / 6` sets from cache with **`0` `"Treino não encontrado"` / error flash** (`sessionDetailErrorFlashObserved: false`), surviving reload and reflecting in `/analytics`. Starting a 2nd session and tapping `"Abandonar"` (`358x44px`) clears the top `"Treino em andamento — toque para retomar"` banner immediately (`254ms`) and restores `"Nenhum treino ativo"` across reload.
   - **L3 Module Size Invariant (`REQ-006`, `invariants.md` Rule 1):** All entrypoints (`<=82` lines) and all `#20` touched/created modules (`<=295` lines) comply strictly with the `<=200` / `<=300`-line ceiling.

---

## 1. Live Unpatched `marombapp-serving-00010-zcx` Route & PWA Audit (`390x844`)

### 1.1 Unauthenticated SPA Route Matrix (`REQ-001`–`REQ-004`, `#19`, `#20`, `#21`)

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

- **`GET /api/healthz` (`ADR-001`, `ADR-004`, `ADR-005`):** HTTP `200` `{"status":"ok","revision":"marombapp-serving-00010-zcx","firestoreDatabase":"marombapp","aiReady":true}` (`PASS`).
- **Google OAuth Popup Check (`REQ-004`):** Clicking `"Entrar com Google"` (`276px x 44px`, `6.07:1` WCAG AA) opens `https://vibe-cabral.firebaseapp.com/__/auth/handler?apiKey=AIzaSy...&authType=signInViaPopup&redirectUrl=https%3A%2F%2Fmarombapp-serving-280799742875.us-central1.run.app%2F...` with `pageErrors: []` and `0` Firestore requests (`PASS`).
- **Offline PWA Reload (`REQ-002`, `REQ-003`):** `/manifest.webmanifest` (`200`, `430` B, `lang: "pt-BR"`), `/icons/icon-192.png` (`200`, `3,055` B), `/icons/icon-512.png` (`200`, `8,602` B), and `/sw.js` (`200`, `1,638` B, `activeState: "activated"`); `context.setOffline(true)` reload on `/`, `/plan`, and `/in-gym` served from Service Worker (`fromServiceWorker: true`, `scrollWidth: 390`, `pageErrors: []`) (`PASS`).
- **Bundle Inspection (`/assets/index-BMwUF882.js` `358,470` B vs `355,888` B in `00009-vvr`, `+2.58 KB` for `#20` optimistic/cache-first plumbing):**
  - `hasGenAiSdk: false`, `hasPrivateKey: false`, `hasSpeculativeAiUi: false` across all 5 JS chunks (`ADR-003`, `invariants.md` Rules 2 & 3).
  - Confirmed `databaseId` `"marombapp"` + `(default)` refusal guard (`hasIssue19DefaultRefusalGuard: true`) + `#21` `foldSearch` & `localizeFirebaseError` (`hasIssue21FoldSearch: true`, `hasIssue21LocalizedErrors: true`) (`PASS`).

---

## 2. `#20` Optimistic Library, Plan & In-Gym Lifecycle Audit (`390x844` — `dist-e2e` of `8c8981b`)

### 2.1 Layout, Overflow & Zero-Flash Verification Across `#20` Transitions

| # | Audited Interactive State (`390x844`) | `<html lang>` | `scrollWidth` (`<=390`) | Overflowing Elements | Clipped Controls | Flash / Glitch Telemetry | Result |
|---|---|---|---|---|---|---|---|
| 1 | `Library`: Initial 66 seeded exercises (`"66 exercícios disponíveis"`) | `pt-BR` | `390` | `0` | `0` | Clean | **PASS** |
| 2 | `Library`: Optimistic `createExercise` (`"Agachamento Búlgaro Isométrico"`, matched via `'agachamento bulgaro isometrico'`) | `pt-BR` | `390` | `0` | `0` | Sheet closed in `94ms` | **PASS** |
| 3 | `Library`: Optimistic `updateExercise` (`"Remada Curvada Unilateral"` · `"Costas · Dorsais"`) + reload | `pt-BR` | `390` | `0` | `0` | `staleLibraryNameAfterEditObserved: false` | **PASS** |
| 4 | `ExerciseDetailSheet`: 2-step delete confirmation open -> optimistic `deleteExercise` + reload | `pt-BR` | `390` | `0` | `0` | Sheet closed in `66ms` (`66` exercises) | **PASS** |
| 5 | `PlanListView`: Initial empty state (`"Você ainda não tem nenhum plano."`) | `pt-BR` | `390` | `0` | `0` | Clean | **PASS** |
| 6 | `PlanDetailView`: Immediately after optimistic `createPlan` (`"Ciclo Força Inicial"`, `"Plano ativo"`) | `pt-BR` | `390` | `0` | `0` | `emptyPlanTitleFlashObserved: false` (`72ms`) | **PASS** |
| 7 | `PlanDetailView`: Immediately after optimistic `reorderPlanDays` (`["Dia B - Puxar", "Dia A - Empurrar"]`) | `pt-BR` | `390` | `0` | `0` | `dayOrderSnapBackObserved: false` | **PASS** |
| 8 | `PlanListView`: After header/inline `renamePlan` + optimistic `archivePlan` (`"Plano Deload Semana 5"`) + reload | `pt-BR` | `390` | `0` | `0` | Archived row hidden in `56ms`, survives reload | **PASS** |
| 9 | `StartWorkout` (`/start`): Active plan `"Ciclo Hipertrofia Avançado"` day picker | `pt-BR` | `390` | `0` | `0` | Clean | **PASS** |
| 10 | `InGym` (`/in-gym`): Immediately after optimistic `createSession` (`sessions/UYrRFglS7MCChCF7uNNG`) | `pt-BR` | `390` | `0` | `0` | `emptyInGymFlashDuringCreateObserved: false` (`175ms`) | **PASS** |
| 11 | `InGym` (`/in-gym`): Active session (`2` completed sets, notes) + sticky `RestBar` after full reload | `pt-BR` | `390` | `0` | `0` | `restTimerRunningAfterReload: true` | **PASS** |
| 12 | `SessionDetail` (`/sessions/:id`): Immediately after optimistic `finishSession` + cache-first `getSession` | `pt-BR` | `390` | `0` | `0` | `sessionDetailErrorFlashObserved: false` (`260ms`, `1.135 kg`, `2 / 6`) | **PASS** |
| 13 | `Analytics` (`/analytics`): Completed workout (`"Dia A - Empurrar"`, `1.135 kg`) reflected immediately | `pt-BR` | `390` | `0` | `0` | `analyticsHasCompletedWorkout: true` | **PASS** |
| 14 | `InGym` (`/in-gym`): Immediately after optimistic `abandonSession` + reload | `pt-BR` | `390` | `0` | `0` | Banner cleared in `254ms`, `"Nenhum treino ativo"` restored | **PASS** |

### 2.2 Action Control Touch-Target Geometry & WCAG Contrast Matrix (`390x844`)

| Screen / Surface | Control | Bounding Box (`W x H` @ `x, y`) | `>=44px` Height | Clipped | Contrast (WCAG 2.1) | Result |
|---|---|---|---|---|---|---|
| `ExerciseDetailSheet` | `"Editar"` / `"Excluir"` | **`174 x 44`** / **`176 x 44`** @ `y=800` | `true` | `false` | **`12.97:1`** (AAA) / **`5.77:1`** (AA) | **PASS** |
| `ExerciseDetailSheet` (2-Step Confirm) | `"Cancelar"` / `"Confirmar"` | **`162 x 44`** / **`162 x 44`** @ `y=787` | `true` | `false` | **`12.97:1`** (AAA) / **`6.09:1`** (AA) | **PASS** |
| `ExerciseFormSheet` *(as-is baseline)* | `"Cancelar"` / `"Criar"` | `175 x 40` / `175 x 40` @ `y=804` | `false` (`40px` as-is) | `false` | **`12.97:1`** (AAA) / **`6.07:1`** (AA) | **PASS** *(REQ-002 as-is)* |
| `PlanListView` | `"+ Criar plano"` | **`358 x 50`** @ `(16, 168)` | `true` | `false` | **`6.81:1`** (AA) | **PASS** |
| `PlanListView` (Inline Create) | `"Cancelar"` / `"Criar"` | **`85.8 x 44`** / **`61.8 x 44`** @ `y=180` | `true` | `false` | **`7.08:1`** (AAA) / **`6.07:1`** (AA) | **PASS** |
| `PlanDetailView` | `"Voltar aos planos"` / `"Excluir plano"` | **`44 x 44`** / **`174.3 x 44`** | `true` | `false` | **`8.33:1`** (AAA) / **`6.02:1`** (AA) | **PASS** |
| `PlanDetailView` (`DayRow`) | `"Excluir <Dia>"` / `"Mover para baixo"` | **`44 x 44`** / `28 x 28` *(as-is)* | `true` / `false` (`28px` as-is) | `false` | **`4.70:1`** (AA) / **`8.02:1`** (AAA) | **PASS** *(REQ-002 as-is)* |
| `PlanListView` (`PlanRow` Menu) | `"Mais opções"` / `"Renomear"` / `"Arquivar"` | **`44 x 44`** / **`174 x 44`** / **`174 x 44`** | `true` | `false` | **`8.02:1`** / **`12.97:1`** / **`12.97:1`** (AAA) | **PASS** |
| `PlanDetailView` | `"Iniciar Treino"` FAB | **`193.8 x 48`** @ `(98.1, 700)` | `true` | `false` | **`7.94:1–9.51:1`** (AAA gradient) | **PASS** |
| `StartWorkout` | Day Card (`"Dia A - Empurrar"`) | **`358 x 112`** @ `(16, 379)` | `true` | `false` | **`14.69:1`** (AAA) | **PASS** |
| `InGym` (Active) | `"Finalizar treino"` / `"Abandonar"` | **`358 x 60`** / **`358 x 44`** | `true` | `false` | **AAA gradient** / **`4.58:1`** (AA) | **PASS** |
| `InGym` (Empty) / `SessionDetail` | `"Iniciar treino"` / `"Excluir treino"` | **`190.4 x 44`** / **`179.8 x 44`** | `true` | `false` | **`6.07:1`** (AA) / **`6.02:1`** (AA) | **PASS** |

---

## 3. L3 Module Size & Safety Telemetry Summary (`REQ-004`–`REQ-006`, `ADR-004`, `ADR-005`)

- **Entrypoints (`<= 200` lines):** `src/main.tsx` (`15`), `src/App.tsx` (`82`), `server/index.ts` (`27`).
- **`#20` Data & Screen Modules (`<= 300` lines):** `src/lib/db/library.ts` (`63`), `src/lib/db/plans.ts` (`295`), `src/lib/db/sessions.ts` (`266`), `src/lib/db/sessionMutations.ts` (`109`), `src/lib/db/sessionShadow.ts` (`130`), `src/screens/Library.tsx` (`257`), `src/screens/library/ExerciseFormSheet.tsx` (`195`), `src/screens/library/ExerciseDetailSheet.tsx` (`162`), `src/screens/Plan.tsx` (`104`), `src/screens/plan/PlanListView.tsx` (`182`), `src/screens/plan/PlanRow.tsx` (`194`), `src/screens/plan/PlanDetailView.tsx` (`293`), `src/screens/plan/DayRow.tsx` (`179`), `src/screens/StartWorkout.tsx` (`203`), `src/screens/InGym.tsx` (`288`), `src/screens/SessionDetail.tsx` (`269`), `src/screens/Analytics.tsx` (`289`).
- **Firestore & Network Isolation (`ADR-004`, `ADR-005`):**
  - Live `marombapp-serving-00010-zcx` audit: `firestoreRequestsObserved.length === 0`.
  - Local `dist-e2e` `#20` audit: `firebaseOrGcpRequestsTotal === 0`, `pageErrorsTotal === 0`, `unhandledRejections.length === 0`.
