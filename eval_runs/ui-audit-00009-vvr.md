# Live Mobile PWA Ergonomics, `#21` Unaccented PT-BR Search & Localized Error-Banner Audit — `marombapp-serving-00009-vvr` (`64f7cd6a37ed`)

- **Auditor:** `ui-auditor` (`marombapp-eval`)
- **Target Service:** `marombapp-serving` (`https://marombapp-serving-280799742875.us-central1.run.app` in `vibe-cabral`)
- **Live Revision:** `marombapp-serving-00009-vvr` (Rollback: `marombapp-serving-00008-m7h`; Source commit: `64f7cd6a37edbdf66d308cc3f565927fcb7b9ae9` / `64f7cd6`, shipping `#21` `eval-finding` fix)
- **Audit Viewport:** `390x844` (`deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`, headless `/usr/bin/chromium`)
- **Audited At (UTC):** `2026-11-15T17:51:09Z` – `2026-11-15T17:55:20Z`
- **Cited Specifications:** `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`, `REQ-005`, `REQ-006`, `ADR-001`, `ADR-003`, `ADR-004`, `ADR-005`, `invariants.md` (Rules 1, 2, 3 & 4), Issues `#16`, `#19`, `#21`
- **Baseline Report:** `/scion-volumes/scratchpad/ui-audit-00008-m7h.md` (`marombapp-serving-00008-m7h` / `bfdd480d8c48`)

---

## Executive Verdict: **PASS (Live `00009-vvr` PWA, `#21` Unaccented PT-BR Search Folding & Localized PT-BR Error Banners Verified at `390x844`)**

1. **Live Unpatched `marombapp-serving-00009-vvr` Mobile PWA & Bundle Hygiene Audit (`REQ-001`–`REQ-005`, `ADR-001`, `ADR-003`, `ADR-004`, `ADR-005`, `#16`, `#19`, `#21`):** **PASS**
   - All 7 SPA routes (`/`, `/plan`, `/library`, `/in-gym`, `/analytics`, `/start`, `/sessions/123`) return HTTP `200`, `<html lang="pt-BR">`, `pageErrors: []`, `scrollWidth === 390` (`0` overflowing elements), `hasInvalidApiKeyBanner: false`, `hasRawFirebaseError: false`, and `hasRefusingDatabaseError: false`.
   - PT-BR `<SignIn />` renders `"MarombApp"` (`14.69:1` WCAG AAA contrast), `"Entre para acompanhar seus treinos"` (`8.02:1` WCAG AAA contrast), and `"Entrar com Google"` (**`276px x 44px`** at `(57, 488)`, `6.07:1` WCAG AA contrast), opening the live `vibe-cabral` Google OAuth handler popup (`https://vibe-cabral.firebaseapp.com/__/auth/handler?...&authType=signInViaPopup`) on click with `0` `pageErrors`.
   - `GET /api/healthz` returns HTTP `200` `{"status":"ok","revision":"marombapp-serving-00009-vvr","firestoreDatabase":"marombapp","aiReady":true}`.
   - `/manifest.webmanifest` (`200 OK`, `430` B, `"lang": "pt-BR"`, `"description": "Diário pessoal de musculação"`), `/icons/icon-192.png` (`3,055` B), `/icons/icon-512.png` (`8,602` B), and `/sw.js` (`1,638` B, `activeState: "activated"`) pass; offline reloads (`context.setOffline(true)`) on `/`, `/plan`, and `/in-gym` resolve from the Service Worker (`fromServiceWorker: true`, `scrollWidth === 390`, `pageErrors: []`).
   - All 5 live JS chunks (`/assets/index-B4ukeQPM.js` `355,888` B, `/assets/Analytics-DgwhYgMM.js` `11,263` B, `/assets/charts-CyQaC5Dm.js` `392,265` B, `/assets/firebase-auth-5xDtBWTY.js` `213,031` B, `/assets/firebase-firestore-BeCyLZzN.js` `348,262` B) contain **`0`** GCP secrets, **`0`** `@google/genai` / Vertex SDK imports, and **`0`** speculative AI UI strings.
   - Live `/assets/index-B4ukeQPM.js` (`+2.95 KB` over `00008-m7h`) preserves the `#19` production `"marombapp"` `databaseId` default + `(default)` refusal guard (`function Hp(n="marombapp"){...throw new Error(\`Refusing Firestore database "${u}"...\`);return u}`) and compiles in both `#21` `foldSearch` (`NFD` + `\p{Diacritic}`) and `localizeFirebaseError` PT-BR strings.
   - **Strict `ADR-004` & `ADR-005` Compliance:** **`0`** requests to `firestore.googleapis.com` (`firestoreRequestsObserved: []`) — zero reads or writes against `(default)`, `marombapp`, or `marombapp-test`.
2. **Focused `390x844` Interactive UI, Layout & Contrast Audit of `#21` PT-BR Search & Error Surfaces (`dist-e2e` of `64f7cd6` in `/tmp/ui-audit-64f7cd6` — `REQ-001`, `REQ-002`, `REQ-006`, `#16`, `#21`):** **PASS (`37/37` layout states at `scrollWidth === 390`, `0` overflowing elements, `0` clipped controls, `100%` WCAG AA/AAA contrast on all error surfaces, `0` raw Firebase error strings, `0` `pageErrors`, `0` Firebase/GCP network calls)**
   - **Unaccented PT-BR Search Ergonomics (`Library`, `PlanDay` `ExercisePickerModal`, `InGym` `ExercisePickerModal`):** Typing `'agachamento bulgaro'`, `'triceps testa'`, `'elevacao lateral'`, `'abdomen'`, `'gluteo'`, `'posterior de coxa'`, and `'biceps martelo'` (matching custom `"Rosca Bíceps Martelo Alternada"`) returns identical, accurately accented PT-BR cards across all 3 surfaces (`1`, `1`, `1`, `6`, `6`, `6`, and `1` matches respectively out of `67` exercises) at `scrollWidth === 390` with **`0.0px` layout shift** on the search `<input>` (`358x56px` @ `14.69:1` AAA on `Library`; `310x20px` inside `358x36px` container @ `12.05:1` AAA on `ExercisePickerModal`). Picking exercises directly from unaccented search results works cleanly in both `PlanDay` and active `InGym` sessions.
   - **Localized PT-BR Error Banners (`SignIn`, `ExerciseFormSheet`, `SessionDetail`):** All 13 audited error scenarios (`5` on `SignIn` + popup-blocked redirect fallback, `4` on `ExerciseFormSheet`, `4` on `SessionDetail`) render idiomatic PT-BR copy wrapping cleanly within `390px` (`scrollWidth === 390`, `0` clipped text/buttons), exceed WCAG 2.1 AA contrast (`7.81:1` AAA on `SignIn`, `5.77:1` AA on `ExerciseFormSheet`, `8.33:1` AAA on `SessionDetail`), and display **zero** `"Firebase: Error (...)"`, raw error codes, or literal `'config'` strings.
   - **L3 Module Size Invariant (`REQ-006`, `invariants.md` Rule 1):** Every module created or touched in `#21` remains strictly `<= 300` lines (`search.ts`: `17`, `errors.pt-BR.ts`: `122`, `pt-BR.ts`: `228`, `auth.tsx`: `162`, `SignIn.tsx`: `68`, `Library.tsx`: `221`, `ExercisePickerModal.tsx`: `173`, `ExerciseFormSheet.tsx`: `184`, `SessionDetail.tsx`: `267`).

---

## 1. Live Unpatched `marombapp-serving-00009-vvr` Route & PWA Audit (`390x844`)

### 1.1 Unauthenticated SPA Route Matrix (`REQ-001`–`REQ-004`, `#16`, `#19`, `#21`)

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

- **`GET /api/healthz` (`ADR-001`, `ADR-004`, `ADR-005`):** HTTP `200` `{"status":"ok","revision":"marombapp-serving-00009-vvr","firestoreDatabase":"marombapp","aiReady":true}` (`PASS`).
- **Google OAuth Popup Check (`REQ-004`):** Clicking `"Entrar com Google"` (`276px x 44px`, `6.07:1` WCAG AA) opens `https://vibe-cabral.firebaseapp.com/__/auth/handler?apiKey=AIzaSy...&authType=signInViaPopup&redirectUrl=https%3A%2F%2Fmarombapp-serving-280799742875.us-central1.run.app%2F...` with `pageErrors: []`, `hasRawFirebaseError: false`, and `0` Firestore requests (`PASS`).
- **Offline PWA Reload (`REQ-002`, `REQ-003`):** `/manifest.webmanifest` (`200`, `430` B, `lang: "pt-BR"`), `/icons/icon-192.png` (`200`, `3,055` B), `/icons/icon-512.png` (`200`, `8,602` B), and `/sw.js` (`200`, `1,638` B, `activeState: "activated"`); `context.setOffline(true)` reload on `/`, `/plan`, and `/in-gym` served from Service Worker (`fromServiceWorker: true`, `scrollWidth: 390`, `pageErrors: []`) (`PASS`).
- **Bundle Inspection (`/assets/index-B4ukeQPM.js` `355,888` B vs `352,940` B in `00008-m7h`, `+2.95 KB` for `#21` `foldSearch` + `errors.pt-BR.ts`):**
  - `hasGenAiSdk: false`, `hasPrivateKey: false`, `hasSpeculativeAiUi: false` across all 5 JS chunks (`ADR-003`, `invariants.md` Rules 2 & 3).
  - Confirmed `databaseId` resolves to `"marombapp"` with `(default)` refusal guard (`hasIssue19DefaultRefusalGuard: true`) and `#21` diacritic folding + PT-BR error catalog (`hasIssue21FoldSearch: true`, `hasIssue21LocalizedErrors: true`) (`PASS`).

---

## 2. `#21` Unaccented PT-BR Search & Localized Error-Banner Audit (`390x844` — `dist-e2e` of `64f7cd6`)

### 2.1 Unaccented PT-BR Search Ergonomics Across `Library`, `PlanDay`, and `InGym` (`REQ-001`, `REQ-002`, `#16`, `#21`)

All 66 canonical exercises auto-seeded on `/library`, and custom accented exercise `"Rosca Bíceps Martelo Alternada"` (`primaryMuscle: "biceps"`, `subMuscle: "brachialis"`, `Personalizado` badge) was created via `ExerciseFormSheet` (`"67 exercícios disponíveis"`). Each unaccented query was typed into:
1. **`Library` (`/library`)** — search `<input>` **`358 x 56px`** @ `(16, 212)`, `14.69:1` AAA contrast (`rgb(219, 229, 255)` on `rgb(0, 19, 47)`), `0.0px` layout shift across empty -> query -> zero-match -> cleared.
2. **`PlanDay` `ExercisePickerModal` (`"Adicionar Exercício"`)** — `<input>` `310 x 20px` inside `358 x 36px` rounded container @ `x=16..374`, `12.05:1` AAA contrast (`rgb(219, 229, 255)` on `rgb(0, 37, 81)`), `0.0px` layout shift; picking `"Rosca Bíceps Martelo Alternada"` from `'biceps martelo'` added it to the day (`"1 exercício"`).
3. **`InGym` `ExercisePickerModal` (`"Adicionar Exercício ao Treino"`, opened via `"Adicionar exercício ao treino"` `358 x 50px` @ `6.81:1` AA)** — identical `310 x 20px` input (`12.05:1` AAA, `0.0px` layout shift); picking `"Agachamento Búlgaro"` from `'agachamento bulgaro'` mounted its exercise card inside the active workout session.

| Unaccented Query Typed | Matches (`Library` / `PlanDay` / `InGym`) | Matched PT-BR Cards Rendered | `scrollWidth` (All 3 Surfaces) | Overflows / Clips | Result |
|---|---|---|---|---|---|
| `'agachamento bulgaro'` | `1` / `1` / `1` | `"Agachamento Búlgaro"` | `390` / `390` / `390` | `0` / `0` | **PASS** |
| `'triceps testa'` | `1` / `1` / `1` | `"Tríceps Testa"` | `390` / `390` / `390` | `0` / `0` | **PASS** |
| `'elevacao lateral'` | `1` / `1` / `1` | `"Elevação Lateral"` | `390` / `390` / `390` | `0` / `0` | **PASS** |
| `'abdomen'` | `6` / `6` / `6` | `"Abdominal na Polia"`, `"Abdominal Supra"`, `"Elevação de Pernas na Barra"`, `"Prancha"`, `"Roda Abdominal"`, `"Russian Twist"` | `390` / `390` / `390` | `0` / `0` | **PASS** |
| `'gluteo'` | `6` / `6` / `6` | `"Agachamento Búlgaro"`, `"Coice na Polia"`, `"Elevação Pélvica"`, `"Levantamento Terra Sumô"`, `"Ponte de Glúteos"`, `"Step Up"` | `390` / `390` / `390` | `0` / `0` | **PASS** |
| `'posterior de coxa'` | `6` / `6` / `6` | `"Cadeira Flexora"`, `"Flexão Nórdica"`, `"Good Morning"`, `"Mesa Flexora"`, `"Stiff"`, `"Terra Romeno (RDL)"` | `390` / `390` / `390` | `0` / `0` | **PASS** |
| `'biceps martelo'` | `1` / `1` / `1` | `"Rosca Bíceps Martelo Alternada"` (`Personalizado`) | `390` / `390` / `390` | `0` / `0` | **PASS** |
| `'exercicio inexistente xyz'` | `0` / `0` / `0` | `"Nenhum exercício encontrado"` (`Library`) / `"Nenhum exercício encontrado."` (`ExercisePickerModal`) | `390` / `390` / `390` | `0` / `0` | **PASS** |

*Ergonomic note (non-blocking, as-is parity preserved per `REQ-002`):* Neither `Library` nor `ExercisePickerModal` renders an inline clear (`X`) button inside the `<input>` (`hasDedicatedClearButton: false`); `ExercisePickerModal`'s header close button (`aria-label="Fechar"`) is `32x32px` (`7.56:1` AAA contrast), and `Library`'s header `"+ Adicionar"` button is `132.6x32px` (`6.07:1` AA contrast), unchanged from the as-is baseline.

### 2.2 Localized PT-BR Error Banners at `390x844` (`SignIn`, `ExerciseFormSheet`, `SessionDetail`)

In addition to verifying that `SignIn`'s default `auth/popup-blocked` path falls back cleanly to `signInWithRedirect` and authenticates into the app shell (`redirectFallbackSucceededCleanly: true`), all 13 error-banner states below were triggered and measured at `390x844`:

| Surface | Triggered Error Code / Condition | Rendered PT-BR Copy | Banner / Copy Box (`W x H` @ `x, y`) | Composited Contrast (`fg` on `bg`) | `scrollWidth` / Overflows / Clips | Raw `"Firebase: Error"` or `'config'` | Result |
|---|---|---|---|---|---|---|---|
| `SignIn` (`/`) | `auth/network-request-failed` | `"Sem conexão de rede. Verifique sua internet e tente novamente."` | Banner `276x58` @ `(57, 447)` (copy `226x32`); CTA `276x44` | **`7.81:1` (AAA)** (`rgb(151,171,212)` on `rgb(32,15,43)`) | `390` / `0` / `0` | `false` | **PASS** |
| `SignIn` (`/`) | `auth/popup-blocked` (popup + redirect blocked) | `"A janela de login foi bloqueada pelo navegador. Permita pop-ups e tente novamente."` | Banner `276x74` @ `(57, 439)` (copy `226x48`); CTA `276x44` | **`7.81:1` (AAA)** (`rgb(151,171,212)` on `rgb(32,15,43)`) | `390` / `0` / `0` | `false` | **PASS** |
| `SignIn` (`/`) | `auth/invalid-api-key` | `"Chave de acesso do Firebase inválida. Verifique a configuração do aplicativo."` | Banner `276x74` @ `(57, 439)` (copy `226x48`); CTA `276x44` | **`7.81:1` (AAA)** (`rgb(151,171,212)` on `rgb(32,15,43)`) | `390` / `0` / `0` | `false` | **PASS** |
| `SignIn` (`/`) | Missing `config` (`Firebase: Error (config).`) | `"Configuração do Firebase inválida ou indisponível. Verifique as credenciais do aplicativo."` | Banner `276x74` @ `(57, 439)` (copy `226x48`); CTA `276x44` | **`7.81:1` (AAA)** (`rgb(151,171,212)` on `rgb(32,15,43)`) | `390` / `0` / `0` | `false` | **PASS** |
| `SignIn` (`/`) | Non-`ALLOWED_UID` (`unauthorized`) | `"Esta conta não está autorizada no MarombApp."` | Banner `276x58` @ `(57, 447)` (copy `226x32`); CTA `276x44` | **`7.81:1` (AAA)** (`rgb(151,171,212)` on `rgb(32,15,43)`) | `390` / `0` / `0` | `false` | **PASS** |
| `ExerciseFormSheet` | Save `permission-denied` (`Missing or insufficient permissions`) | `"Sem permissão para acessar ou salvar estes dados."` | Banner `358x66` @ `(16, 714)` (copy `308x40`); `"Cancelar"`/`"Criar"` `175x40` | **`5.77:1` (AA)** (`rgb(255,113,108)` on `rgb(38,33,56)`) | `390` / `0` / `0` | `false` | **PASS** |
| `ExerciseFormSheet` | Save `unavailable` (`Firebase: Error (unavailable).`) | `"Serviço temporariamente indisponível. Verifique sua conexão e tente novamente."` | Banner `358x66` @ `(16, 714)` (copy `308x40`); `"Cancelar"`/`"Criar"` `175x40` | **`5.77:1` (AA)** (`rgb(255,113,108)` on `rgb(38,33,56)`) | `390` / `0` / `0` | `false` | **PASS** |
| `ExerciseFormSheet` | Edit deleted doc `not-found` (`No document to update`) | `"Registro não encontrado."` | Banner `358x46` @ `(16, 734)` (copy `176.3x20`) | **`5.77:1` (AA)** (`rgb(255,113,108)` on `rgb(38,33,56)`) | `390` / `0` / `0` | `false` | **PASS** |
| `ExerciseFormSheet` | Unmapped raw English SDK error fallback | `"Falha ao salvar"` | Banner `358x46` @ `(16, 734)` (copy `105.1x20`) | **`5.77:1` (AA)** (`rgb(255,113,108)` on `rgb(38,33,56)`) | `390` / `0` / `0` | `false` | **PASS** |
| `SessionDetail` | Load `permission-denied` (`Firebase: Error (permission-denied).`) | `"Sem permissão para acessar ou salvar estes dados."` | Copy `358x40` @ `(16, 112)`; `"Voltar para análises"` `240.8x32` (`14.69:1` AAA) | **`8.33:1` (AAA)** (`rgb(151,171,212)` on `rgb(0,14,38)`) | `390` / `0` / `0` | `false` | **PASS** |
| `SessionDetail` | Load `unavailable` (`Firebase: Error (unavailable).`) | `"Serviço temporariamente indisponível. Verifique sua conexão e tente novamente."` | Copy `358x40` @ `(16, 112)`; `"Voltar para análises"` `240.8x32` (`14.69:1` AAA) | **`8.33:1` (AAA)** (`rgb(151,171,212)` on `rgb(0,14,38)`) | `390` / `0` / `0` | `false` | **PASS** |
| `SessionDetail` | Unmapped raw English offline error fallback | `"Falha ao carregar treino"` | Copy `358x20` @ `(16, 112)`; `"Voltar para análises"` `240.8x32` (`14.69:1` AAA) | **`8.33:1` (AAA)** (`rgb(151,171,212)` on `rgb(0,14,38)`) | `390` / `0` / `0` | `false` | **PASS** |
| `SessionDetail` | Missing document (`/sessions/s-nonexistent`) | `"Treino não encontrado"` | Copy `358x20` @ `(16, 112)`; `"Voltar para análises"` `240.8x32` (`14.69:1` AAA) | **`8.33:1` (AAA)** (`rgb(151,171,212)` on `rgb(0,14,38)`) | `390` / `0` / `0` | `false` | **PASS** |

---

## 3. L3 Module Size & Safety Telemetry Summary (`REQ-004`–`REQ-006`, `ADR-004`, `ADR-005`)

- **Module Line Counts (`<= 300` lines per module, `<= 200` per entrypoint):**
  - `src/App.tsx`: `82` lines (`<= 200` entrypoint)
  - `src/lib/i18n/search.ts`: `17` lines
  - `src/lib/i18n/errors.pt-BR.ts`: `122` lines
  - `src/lib/i18n/pt-BR.ts`: `228` lines
  - `src/lib/auth.tsx`: `162` lines
  - `src/screens/SignIn.tsx`: `68` lines
  - `src/screens/Library.tsx`: `221` lines
  - `src/components/ExercisePickerModal.tsx`: `173` lines
  - `src/screens/library/ExerciseFormSheet.tsx`: `184` lines
  - `src/screens/SessionDetail.tsx`: `267` lines
- **Firestore & Network Isolation (`ADR-004`, `ADR-005`):**
  - Live `marombapp-serving-00009-vvr` audit: `firestoreRequestsObserved.length === 0`.
  - Local `dist-e2e` `#21` audit: `firebaseOrGcpRequestsTotal === 0` (`page.route` blocked all external egress; `100%` `localStorage` fakes).
