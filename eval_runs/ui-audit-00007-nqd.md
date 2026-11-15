# Live Mobile PWA Ergonomics & `#16` PT-BR Full-App Layout Audit — `marombapp-serving-00007-nqd` (`8d46610cf2e3`)

- **Auditor:** `ui-auditor` (`marombapp-eval`)
- **Target Service:** `marombapp-serving` (`https://marombapp-serving-280799742875.us-central1.run.app` in `vibe-cabral`)
- **Live Revision:** `marombapp-serving-00007-nqd` (Source commit: `8d46610cf2e31c52dba2dc5d694767263593a62f`, rollback: `marombapp-serving-00006-5rz`, shipping `#14` and `#16` *"Tradução completa PT-BR"*)
- **Audit Viewport:** `390x844` (`deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`, headless `/usr/bin/chromium`)
- **Audited At (UTC):** `2026-11-15T16:11:35Z` – `2026-11-15T16:23:28Z`
- **Cited Specifications:** `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`, `REQ-005`, `REQ-006`, `ADR-001`, `ADR-003`, `ADR-004`, `ADR-005`, `invariants.md` (Rules 2, 3 & 4), Issues `#13`, `#14`, `#16`
- **Baseline Comparison:** `/scion-volumes/scratchpad/ui-audit-00005-99q.md` (`marombapp-serving-00005-99q` / `30e33c3e503c`)

---

## Executive Verdict: **PASS (Live `00007-nqd` PWA & Full `#16` PT-BR `390x844` Layout, Touch-Target & Translation Suite Verified)**

1. **Live Unpatched Service Audit (`marombapp-serving-00007-nqd` in `vibe-cabral` — `REQ-001`–`REQ-005`, `ADR-001`, `ADR-003`, `ADR-004`, `ADR-005`, `#16`):** **PASS**
   - All 7 SPA routes (`/`, `/plan`, `/library`, `/in-gym`, `/analytics`, `/start`, `/sessions/123`) return HTTP `200`, `<html lang="pt-BR">`, `pageErrors: []`, `scrollWidth === 390` (`0` overflowing elements), render `<SignIn />` (`h1` `"MarombApp"` at `14.69:1` WCAG AAA contrast; PT-BR subtitle `"Entre para acompanhar seus treinos"` at `8.02:1` AAA contrast; `"Entrar com Google"` CTA button at **`276px x 44px`** and `6.07:1` WCAG AA contrast), show `hasInvalidApiKeyBanner: false`, and open the live `vibe-cabral` Google OAuth popup (`https://vibe-cabral.firebaseapp.com/__/auth/handler?...&authType=signInViaPopup`) on click.
   - `GET /manifest.webmanifest` (`200 OK`, `430` bytes) serves localized `"lang": "pt-BR"` and `"description": "Diário pessoal de musculação"`; `/icons/icon-192.png` (`3,055` bytes), `/icons/icon-512.png` (`8,602` bytes), and `/sw.js` (`1,638` bytes, `activeState: "activated"`) return `200 OK`. Offline reloads (`context.setOffline(true)`) on `/`, `/plan`, and `/in-gym` resolve from the Service Worker (`fromServiceWorker: true`) with `<html lang="pt-BR">`, PT-BR `<SignIn />`, `scrollWidth === 390`, and `pageErrors: []`.
   - Live client bundles (`/assets/index-BL4jQA4-.js` `351,286` bytes, `/assets/Analytics-C6kxVKz-.js` `11,263` bytes, `/assets/charts-CyQaC5Dm.js` `392,265` bytes, `/assets/firebase-auth-5xDtBWTY.js` `213,031` bytes, `/assets/firebase-firestore-CFeFN6hU.js` `348,086` bytes) contain **`0`** speculative AI UI strings, **`0`** `@google/genai` / `vertexai.googleapis.com` imports, **`0`** GCP service-account secrets, and embed the expected `vibe-cabral` Firebase web config targeting production database `"marombapp"`. `GET /api/healthz` returns `{"status":"ok","revision":"marombapp-serving-00007-nqd","firestoreDatabase":"marombapp","aiReady":true}`.
   - **Strict `ADR-005` Compliance:** Zero Firestore reads/writes were performed against `(default)`, `marombapp`, or `marombapp-test`.
2. **`#16` PT-BR Full-App `390x844` Layout, Overflow, Wrapping, Touch-Target & Translation Audit (`dist-e2e` of `8d46610cf2e3` in `/tmp/ui-audit-8d46610` — `REQ-001`, `REQ-002`, `REQ-006`, `#13`, `#14`, `#16`):** **PASS (`25/25` screens/modals at `scrollWidth === 390`, `0` unintended overflows, `0` clipped buttons/tabs, `0` English UI leaks, `16/16` `#13`/`#14` deletion & cancel controls `>=44x44px`, `0` `pageErrors`, `0` Firebase network calls)**
   - **Bottom Navigation Bar (`Planos / Treino / Biblioteca / Análises`) & Active Workout Banner:** All 4 localized tabs fit cleanly inside `390px` with symmetrical **`39.6px`** inter-tab spacing (`Planos` `46.4x43` @ `x=24`, `Treino` `43.7x43` @ `x=110`, `Biblioteca` `76.3x43` @ `x=193.4`, `Análises` `56.7x43` @ `x=309.3`, right edge `366.0`), zero text truncation, and `docScrollWidth: 390`. `ActiveSessionBanner` (`"Treino em andamento — toque para retomar"`) renders cleanly at `390px x 49px` (`y=719`) without overflow.
   - **Long PT-BR Button & Exercise Wrapping at `390px`:** Side-by-side `"Definir como plano ativo"` (`175.8px x 66px`, clean 2-line wrap) + `"Excluir plano"` (`174.3px x 44px`) on `PlanDetailView` maintain an `8px` gap and `16px` outer margins (`scrollWidth === 390`, zero clipping/overlap). Long translated exercise names (`"Supino Inclinado com Halteres"`, `"Desenvolvimento Militar"`, `"Levantamento Terra Sumô"`, `"Panturrilha Unilateral"`, `"Terra Romeno (RDL)"`, `"Posterior de Coxa · Bíceps femoral"`) render cleanly across `Library`, `PlanDay`, `StartWorkout`, `InGym` (with sticky `RestBar` `"Descanso"` active), `Analytics` (`WeeklySplitCard` & `OverloadCard`), and `SessionDetail`.
   - **`#13`/`#14` PT-BR Deletion & Cancel Ergonomics:** All `16/16` audited deletion and inline-cancel controls (`"Excluir dia de treino"` `238.4x44`, `"Excluir plano"` `174.3x44`, `"Excluir treino"` `179.8x44`, `"Mais opções"` `44x44` -> `"Excluir"` `174x44`, `DayRow` `"Excluir <dia>"` `44x44`, `PlanDay` `"Remover exercício"` `44x44`, `InGym` `"Remover <exercício>"` `44x44`, `"Remover última série"` `44x44`, `"Abandonar"` `358x44`, custom exercise `"Editar"` `174x44` / `"Excluir"` `176x44` -> `"Cancelar"` `162x44` / `"Confirmar"` `162x44`, and inline creation `"Cancelar"` `85.8x44`) meet `>=44x44px` and trigger named PT-BR confirmation prompts.

---

## 1. Live Route Rendering, `<html lang="pt-BR">` & Overflow (`390x844` — `REQ-001`–`REQ-004`, `#16`)

All 7 routes were audited directly against `https://marombapp-serving-280799742875.us-central1.run.app` (`marombapp-serving-00007-nqd`).

| Route | HTTP Status | `<html lang>` | Uncaught `pageErrors` | `auth/invalid-api-key` | Heading / Subtitle | CTA Button (`W x H`) | `scrollWidth` (`<=390`) | Overflowing Elements | Result |
|---|---|---|---|---|---|---|---|---|---|
| `/` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/plan` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/library` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/in-gym` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/analytics` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/start` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/sessions/123` | `200` | `"pt-BR"` | `0` (`[]`) | `false` | `"MarombApp"` / `"Entre para acompanhar seus treinos"` | `"Entrar com Google"` (`276x44`) | `390` | `0` | **PASS** |

---

## 2. Live PT-BR Sign-In Ergonomics, PWA Manifest/SW & Bundle Hygiene (`00007-nqd`)

- **Sign-In Accessibility & Live OAuth Flow (`REQ-001`, `REQ-004`, `ADR-004`, `#16`):**
  - Heading `"MarombApp"` (`h1`): `30px` (`font-weight: 600`), `rgb(219, 229, 255)` on `rgb(0, 19, 47)` -> **`14.69:1`** WCAG AAA (`PASS`).
  - Subtitle `"Entre para acompanhar seus treinos"` (`p`): `14px` (`font-weight: 400`), `rgb(151, 171, 212)` on `rgb(0, 19, 47)` -> **`8.02:1`** WCAG AAA (`PASS`).
  - CTA `"Entrar com Google"` (`button[type="button"]`): **`276px x 44px`** at `(57px, 488px)`, `borderRadius: 12px`, `rgb(0, 48, 85)` on `rgb(106, 178, 255)` -> **`6.07:1`** WCAG AA (`PASS`).
  - Clicking `"Entrar com Google"`: `pageErrors: []`, `hasInvalidApiKeyBanner: false`, opens live `vibe-cabral` OAuth handler popup (`https://vibe-cabral.firebaseapp.com/__/auth/handler?apiKey=AIzaSy...&authType=signInViaPopup&redirectUrl=https%3A%2F%2Fmarombapp-serving-280799742875.us-central1.run.app%2F...`), `scrollWidth: 390` (`PASS`).
- **PWA Manifest (`pt-BR`), Icons, Service Worker & Offline Reload (`REQ-002`, `REQ-003`, `ADR-001`, `#16`):**
  - `GET /manifest.webmanifest`: HTTP `200` (`application/manifest+json; charset=utf-8`, `430` bytes), verified `"name": "MarombApp"`, `"short_name": "Maromba"`, `"description": "Diário pessoal de musculação"`, `"lang": "pt-BR"`, `"display": "standalone"`, `"background_color": "#000e26"`, `"theme_color": "#000e26"`.
  - `GET /icons/icon-192.png` (`200 OK`, `3,055` bytes), `GET /icons/icon-512.png` (`200 OK`, `8,602` bytes), `GET /sw.js` (`200 OK`, `1,638` bytes, `activeState: "activated"` at scope `https://marombapp-serving-280799742875.us-central1.run.app/`).
  - `context.setOffline(true)` reload on `/`, `/plan`, and `/in-gym`: all 3 return HTTP `200` (`fromServiceWorker: true`), `<html lang="pt-BR">`, `pageErrors: []`, render `"MarombApp / Entre para acompanhar seus treinos / Entrar com Google"` (`276px x 44px`), `scrollWidth: 390` (`PASS`).
- **Bundle Hygiene & Healthz (`REQ-002`, `REQ-005`, `ADR-003`, `ADR-004`, Invariants 2 & 3):**
  - Inspected all 5 JS bundles (`/assets/index-BL4jQA4-.js` `351,286` B, `/assets/Analytics-C6kxVKz-.js` `11,263` B, `/assets/charts-CyQaC5Dm.js` `392,265` B, `/assets/firebase-auth-5xDtBWTY.js` `213,031` B, `/assets/firebase-firestore-CFeFN6hU.js` `348,086` B): **`0`** speculative AI UI strings, **`0`** `@google/genai` / `vertexai.googleapis.com` imports, **`0`** GCP service-account secrets (`PRIVATE_KEY`, `client_secret`).
  - Verified `vibe-cabral` Firebase web config in `/assets/index-BL4jQA4-.js` (`authDomain: "vibe-cabral.firebaseapp.com"`, `projectId: "vibe-cabral"`, `appId: "1:280799742875:web:e47e00f1afcdab5e92af3e"`, `allowedUid: "iELlq0wRQhR2F5NmrM6pbMSrJuj1"`, `databaseId: "marombapp"`). Note: chunk size delta vs `00005-99q` (`351,286` B vs `339,427` B, `+11.8 KB`) reflects the `pt-BR` UI & 66-exercise glossary dictionary (`src/lib/i18n/*`) plus `#14` updates while splitting `Analytics-C6kxVKz-.js` (`11.3 KB`).
  - `GET /api/healthz`: HTTP `200` `{"status":"ok","revision":"marombapp-serving-00007-nqd","firestoreDatabase":"marombapp","aiReady":true}` (`PASS`).

---

## 3. `#16` PT-BR Full-App `390x844` Screen Overflow, Clipping & Translation Matrix (`dist-e2e`)

Audited in `/tmp/ui-audit-8d46610` built with `vite.e2e.config.ts` (`localStorage` Firebase fakes, `0` requests to `vibe-cabral`, `pageErrorsTotal: 0`). Idiomatic Brazilian gym terms intentionally preserved in `EXERCISE_NAMES_PT_BR` (`Crossover`, `Face Pull`, `Farmer's Walk`, `Russian Twist`, `Step Up`, `Leg Press`, `Good Morning`, `Stiff`, plus `Kg`/`Reps`) were verified alongside full PT-BR translations.

| # | Screen / Modal State | `<html lang>` | `scrollWidth` (`<=390`) | Unintended Overflow Elements | Clipped Controls | Horizontal Sibling Overlaps | Untranslated English UI Leaks | Result |
|---|---|---|---|---|---|---|---|---|
| 1 | `SignIn` (Unauthorized UID banner: `"Esta conta não está autorizada no MarombApp."`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 2 | `Library` (`66 exercícios disponíveis`, PT-BR alphabetical sort, search & 12 muscle chips) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 3 | `Library` (filtered by `"Posterior de Coxa"` chip -> `"Terra Romeno (RDL)"`, `"Mesa Flexora"`, `"Cadeira Flexora"`, `"Stiff"`, `"Flexão Nórdica"`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 4 | `ExerciseDetailSheet` (Seeded: `"Supino Inclinado com Halteres"`, `"Peito"`, read-only `0` `Editar`/`Excluir`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 5 | `ExerciseFormSheet` (`"Novo exercício"`, PT-BR muscle/sub-muscle `<select>`, `"Cancelar"` / `"Criar"`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 6 | `ExerciseDetailSheet` (Custom: `"Crucifixo Unilateral na Polia"`, `"Personalizado"`, `"Peitoral médio"`, `"Editar"` / `"Excluir"`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 7 | `ExerciseDetailSheet` (Step 2: `"Excluir Crucifixo Unilateral na Polia? Esta ação não pode ser desfeita."`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 8 | `PlanListView` (`/plan`: `"Seus Planos"`, `"Planos de Treino"`, `"Ativo"` badge, `"2 dias"`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 9 | `PlanListView` (Inline `"Criar plano"` open: `"Nome do plano (ex.: PPL)"`, `"Cancelar"` / `"Criar"`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 10 | `PlanListView` (`"Mais opções"` menu open: `"Definir como ativo"`, `"Renomear"`, `"Arquivar"`, `"Excluir"`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 11 | `PlanDetailView` (Inactive plan: side-by-side `"Definir como plano ativo"` + `"Excluir plano"`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 12 | `PlanDetailView` (Active plan: `"Plano ativo"` + `"Excluir plano"`, `DayRow`s, `"Iniciar Treino"` FAB) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 13 | `PlanDetailView` (Inline `"Adicionar Dia"` open: `"Cancelar"` / `"Adicionar"`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 14 | `PlanDay` (Newly created empty day: `"Excluir dia de treino"` + `"Nenhum exercício ainda..."`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 15 | `PlanDay` (Populated with `"Supino Inclinado com Halteres"`, `"Desenvolvimento Militar"`, `"Levantamento Terra Sumô"`, `"Terra Romeno (RDL)"`, `"Panturrilha Unilateral"`, `Séries / Reps Mín / Reps Máx`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 16 | `ExercisePickerModal` (`"Adicionar Exercício"` from `PlanDay`, `"Adicionado"` badge, muscle chips) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 17 | `InGym` (Empty state: `"Nenhum treino ativo"`, `"Iniciar treino"`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 18 | `StartWorkout` (`/start`: `"Iniciar treino"`, `"Escolha um dia de treino para começar a registrar."`, PT-BR exercise preview) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 19 | `InGym` (Active workout + sticky `RestBar` `"Descanso"` + `"Treino Ativo"` + `"Últimos treinos"` `há 4 dias` `32,5×8` + `Série / Kg / Reps / Feito`) | `pt-BR` | `390` | `0` | `0` | `0` *(sticky bars only)* | `0` | **PASS** |
| 20 | `Layout` `ActiveSessionBanner` (`"Treino em andamento — toque para retomar"` above bottom nav on `/plan`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 21 | `ExercisePickerModal` (`"Adicionar Exercício ao Treino"` from `InGym`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 22 | `Analytics` (`/analytics`: `"treinos nesta semana"`, PT-BR `.` thousands `"kg de volume"`, `"Divisão muscular da semana"` with `"Posterior de Coxa"`, `"Treinos recentes"`, `"Sobrecarga progressiva"` `"Maior carga"` / `"Volume"`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 23 | `SessionDetail` (Completed `/sessions/s-1`: `"Voltar"` + `"Excluir treino"`, `"Treino concluído"`, 3-col `Duração / Volume / Séries`, PT-BR comma decimal `32,5` kg) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 24 | `SessionDetail` (Abandoned `/sessions/s-abandoned`: `"Treino • abandonado"`, `"Excluir treino"`) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |
| 25 | `SessionDetail` (Active `/sessions/s-active`: `"Treino • ativo"`, `"Excluir treino"` hidden) | `pt-BR` | `390` | `0` | `0` | `0` | `0` | **PASS** |

---

## 4. Bottom Navigation Bar & PT-BR Touch-Target / Ergonomics Matrix (`390x844`)

### 4.1 Bottom Navigation Bar (`Planos / Treino / Biblioteca / Análises`)

| Tab Label | Bounding Box (`W x H` @ `x, y`) | Right Edge (`<=390`) | Gap to Next Tab | Text Clipped | Contrast | Result |
|---|---|---|---|---|---|---|
| `"Planos"` (`/plan`) | `46.4 x 43` @ `(24.0, 789)` | `70.4` | `39.6px` | `false` | `4.05:1` (inactive) / `8.31:1` (active) | **PASS** |
| `"Treino"` (`/in-gym`) | `43.7 x 43` @ `(110.0, 789)` | `153.7` | `39.7px` | `false` | `4.05:1` (inactive) / `8.31:1` (active) | **PASS** |
| `"Biblioteca"` (`/library`) | `76.3 x 43` @ `(193.4, 789)` | `269.7` | `39.6px` | `false` | `8.31:1` (active) / `4.05:1` (inactive) | **PASS** |
| `"Análises"` (`/analytics`) | `56.7 x 43` @ `(309.3, 789)` | `366.0` (`24px` right pad) | — | `false` | `4.05:1` (inactive) / `8.31:1` (active) | **PASS** |

### 4.2 Key PT-BR Action, Deletion & Cancel Controls (`#13`, `#14`, `#16`)

| Screen / Surface | PT-BR Control | Bounding Box (`W x H` @ `x, y`) | `>=44x44` | Clipped | Contrast (WCAG 2.1) | PT-BR Confirmation / Behavior | Result |
|---|---|---|---|---|---|---|---|
| `PlanDetailView` (Inactive) | `"Definir como plano ativo"` | **`175.8 x 66`** @ `(16, 160)` | `true` | `false` (2-line wrap) | **`14.69:1`** (AAA) | Side-by-side `8px` gap next to `"Excluir plano"` | **PASS** |
| `PlanDetailView` (Inactive / Active) | `"Excluir plano"` | **`174.3 x 44`** @ `(199.8, 171 / 161)` | `true` | `false` | **`6.02:1`** (AA) | `confirm('Excluir o plano "<nome>"? Esta ação não pode ser desfeita.')` | **PASS** |
| `PlanDetailView` (Active) | `"Plano ativo"` | **`175.8 x 46`** @ `(16, 160)` | `true` | `false` | **`7.40:1`** (AAA) | Side-by-side `8px` gap next to `"Excluir plano"` | **PASS** |
| `PlanDetailView` (Active FAB) | `"Iniciar Treino"` | **`193.8 x 48`** @ `(98.1, 700)` | `true` | `false` | **`7.94:1–9.51:1`** (AAA gradient) | Navigates to `/start` | **PASS** |
| `PlanDetailView` (`DayRow`) | `"Excluir <dia>"` (`Trash2`) | **`44 x 44`** @ `(314, 298)` | `true` | `false` | **`4.70:1`** (AA icon) | `confirm('Excluir o dia de treino "Superior & Posterior"?')` | **PASS** |
| `PlanDetailView` (inline `Adicionar Dia`) | `"Cancelar"` / `"Adicionar"` | **`85.8 x 44`** / **`93.5 x 44`** @ `y=498` | `true` | `false` | **`7.08:1`** / **`6.07:1`** | Aborts inline day input or creates day | **PASS** |
| `PlanDay` (header / empty day) | `"Excluir dia de treino"` | **`238.4 x 44`** @ `(135.6, 160)` | `true` | `false` | **`6.02:1`** (AA) | `inInitialViewport: true`; `confirm('Excluir o dia de treino "Dia Criado por Engano"?')` | **PASS** |
| `PlanDay` (exercise card) | `"Remover exercício"` (`X`) | **`44 x 44`** @ `(314, 248)` | `true` | `false` | **`8.02:1`** (AAA icon) | `confirm('Remover "Supino Inclinado com Halteres" de "Superior & Posterior"?')` | **PASS** |
| `PlanListView` (inline `Criar plano`) | `"Cancelar"` / `"Criar"` | **`85.8 x 44`** / **`61.8 x 44`** @ `y=180` | `true` | `false` | **`7.08:1`** / **`6.07:1`** | Aborts inline plan input or creates plan | **PASS** |
| `PlanListView` (`Mais opções` menu) | `"Mais opções"` (`⋮`) -> `"Excluir"` | **`44 x 44`** -> **`174 x 44`** | `true` | `false` | **`8.02:1`** -> **`6.10:1`** | `confirm('Excluir o plano "<nome>"? Esta ação não pode ser desfeita.')` | **PASS** |
| `SessionDetail` (`completed` / `abandoned`) | `"Voltar"` / `"Excluir treino"` | **`81.9 x 44`** / **`179.8 x 44`** @ `y=88` | `true` | `false` | **`8.33:1`** / **`6.02:1`** | `confirm('Excluir o treino "Superior & Posterior Pesado"? Esta ação não pode ser desfeita.')` | **PASS** |
| `SessionDetail` (`active`) | `"Excluir treino"` | *Not rendered (`count === 0`)* | — | — | — | Hidden while `status === 'active'` | **PASS** |
| `Library` (`ExerciseDetailSheet`, custom) | `"Editar"` / `"Excluir"` | **`174 x 44`** / **`176 x 44`** @ `y=800` | `true` | `false` | **`12.97:1`** / **`5.77:1`** | Opens two-step inline PT-BR delete confirmation | **PASS** |
| `Library` (`ExerciseDetailSheet`, step 2) | `"Cancelar"` / `"Confirmar"` | **`162 x 44`** / **`162 x 44`** @ `y=787` | `true` | `false` | **`12.97:1`** / **`6.09:1`** | `"Excluir <nome>? Esta ação não pode ser desfeita."` | **PASS** |
| `InGym` (`ExerciseCard`) | `"Remover <Exercício>"` (`X`) | **`44 x 44`** @ `(314, 476.5)` | `true` | `false` | **`3.64:1`** (AA UI icon) | `confirm('Remover <nome> e suas séries concluídas deste treino?')` (or without sets) | **PASS** |
| `InGym` (`ExerciseCard`) | `"Remover última série"` (`−`) | **`44 x 44`** @ `(314, 399.5)` | `true` | `false` | **`4.51:1`** (AA UI icon) | Immediate undo if uncompleted; `confirm('Remover a última série concluída?')` if completed | **PASS** |
| `InGym` (`ActiveSessionView`) | `"Finalizar treino"` / `"Abandonar"` | **`358 x 60`** / **`358 x 44`** | `true` | `false` | **`6.16:1–7.38:1`** / **`4.58:1`** | `confirm('Finalizar este treino?')` / `confirm('Abandonar este treino? As séries registradas serão mantidas no histórico.')` | **PASS** |

---

## 5. Non-Blocking Pre-Existing / Informational Ergonomics Notes

Consistent with the previous `00005-99q` baseline (`REQ-002` as-is visual parity — zero regression introduced by `#16`):
1. **Pre-existing compact modal/header controls (`< 44px`):** `ExerciseFormSheet` `"Cancelar"` / `"Criar"` buttons (`175px x 40px`), `BottomSheet` `"Fechar janela"` / `ExercisePickerModal` `"Fechar"` header `X` buttons (`32px x 32px`, with full-screen backdrop tap dismiss), `TopAppBar` `"Menu da conta"` avatar (`36px x 36px`) -> `"Sair"` (`190px x 36px`), `Library` header `"+ Adicionar"` (`32px` height), and horizontal filter chips (`34px` height).
2. **Pre-existing `ActiveSessionBanner` utility token:** `Layout.tsx` uses `bg-error/15 text-error border-error/30` while `@theme` in `src/index.css` defines `--color-secondary` rather than `--color-error`; the banner renders legibly in `--color-on-surface` (`15.28:1` AAA contrast, `390px x 49px`) with zero overflow or truncation.
