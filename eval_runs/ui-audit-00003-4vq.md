# Live Mobile PWA Ergonomics & UI Re-Audit (#9) — `marombapp-serving-00003-4vq` (`6f3d1ce8adde`)

- **Auditor:** `ui-auditor` (`marombapp-eval`)
- **Target Service:** `marombapp-serving` (`https://marombapp-serving-w3ei3fpeiq-uc.a.run.app`)
- **Live Revision:** `marombapp-serving-00003-4vq` (Source commit: `6f3d1ce8adde8fae306ba0338e8617e1831cbce7`)
- **Audit Viewport:** `390x844` (`deviceScaleFactor: 3`, mobile touch enabled, headless `/usr/bin/chromium`)
- **Audited At (UTC):** `2026-11-08T05:53:45Z` – `2026-11-08T05:54:26Z`
- **Cited Specifications:** `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`, `REQ-005`, `ADR-001`, `ADR-003`, `invariants.md` (Rules 2 & 3)

---

## Executive Verdict: **PASS (All Checks Verified on Unpatched Live Revision)**

1. **Resolution of `eval-finding` `#9` (`REQ-001`, `REQ-002`, `REQ-004`):** **PASS**
   - Uncaught `FirebaseError: Firebase: Error (auth/invalid-api-key).` white-screen defect is **resolved** on live revision `marombapp-serving-00003-4vq`.
   - Across all 7 routes (`/`, `/plan`, `/library`, `/in-gym`, `/analytics`, `/start`, `/sessions/123`), `pageErrors` is `[]` (`0` uncaught exceptions), and `<SignIn />` mounts and renders cleanly on the live deployment.
2. **Sign-In Click Interaction & Error Banner (`REQ-002`, `REQ-004`):** **PASS**
   - Clicking `"Sign in with Google"` on the live deployment triggers `0` uncaught exceptions (`pageErrors: []`), displays the styled user-facing error banner (`"Firebase: Error (auth/invalid-api-key)."` while Firebase web config is pending PO `#7`), preserves button interactivity (`276px x 44px`, `disabled: false`), and maintains `scrollWidth === 390`.
3. **Viewport Overflow (`390x844`) & Touch Target Ergonomics (`REQ-001`, `REQ-002`, `REQ-003`):** **PASS**
   - Every SPA route renders with `document.documentElement.scrollWidth === 390` (`0` overflowing elements).
   - Primary CTA button `"Sign in with Google"` measures **`276px x 44px`** (`>= 44px` height and width gym touch target requirement) with **`6.85:1`** WCAG contrast (`rgb(0, 48, 85)` on `rgb(106, 178, 255)`).
4. **PWA Manifest, Service Worker & Offline Reload (`REQ-002`, `REQ-003`, `ADR-001`):** **PASS**
   - `/manifest.webmanifest` (`200 OK`), `/icons/icon-192.png` (`200 OK`), `/icons/icon-512.png` (`200 OK`), and `/sw.js` (`200 OK`, `activeState: "activated"`) precache the static app shell.
   - Offline reload (`context.setOffline(true)`) on `/`, `/plan`, and `/in-gym` serves HTTP `200` from Service Worker (`fromServiceWorker: true`) and renders `<SignIn />` with the `"Sign in with Google"` button (`276px x 44px`) and `scrollWidth === 390`.
5. **No Speculative AI UI & Bundle Secret Hygiene (`REQ-002`, `REQ-005`, `ADR-003`, Invariants 2 & 3):** **PASS**
   - Zero unrequested AI workout generation/evaluation screens or buttons in the DOM or `/assets/index-By6ZiK3q.js` (`335,186` bytes); zero Vertex AI SDK imports or GCP keys in client assets.

---

## 1. Live Route Rendering, Page Errors & Overflow (`390x844` — `REQ-001`, `REQ-002`, `REQ-003`)

All 7 routes were audited directly against `https://marombapp-serving-w3ei3fpeiq-uc.a.run.app` without any script interception.

| Route | HTTP Status | Uncaught `pageErrors` | Rendered Heading (`h1`) | Rendered CTA Button (`W x H`) | `scrollWidth` (`<=390`) | Overflowing Elements | Result |
|---|---|---|---|---|---|---|---|
| `/` | `200` | `0` (`[]`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/plan` | `200` | `0` (`[]`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/library` | `200` | `0` (`[]`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/in-gym` | `200` | `0` (`[]`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/analytics` | `200` | `0` (`[]`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/start` | `200` | `0` (`[]`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/sessions/123` | `200` | `0` (`[]`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |

---

## 2. Touch Targets, Accessibility & Sign-In Click Verification (`REQ-001`, `REQ-002`, `REQ-004`)

| Element / Action | Measurement / Observation | Requirement | Result |
|---|---|---|---|
| `"Sign in with Google"` (`button[type="button"]`) | Bounding box: **`276px x 44px`** at `(57px, 522px)`, `borderRadius: 12px` | `>= 44px` height & width | **PASS** |
| Button Typography & Contrast | `14px` (`font-weight: 600`), `rgb(0, 48, 85)` on `rgb(106, 178, 255)` -> **`6.85:1`** | WCAG AA (`>= 4.5:1`) | **PASS** |
| Heading `"MarombApp"` (`h1`) | `30px` (`font-weight: 600`), `rgb(219, 229, 255)` on `rgb(4, 22, 51)` -> **`14.80:1`** | WCAG AAA (`>= 7.0:1`) | **PASS** |
| Clicking `"Sign in with Google"` (empty Firebase config pending PO `#7`) | `0` uncaught errors (`pageErrors: []`); displays user-facing alert banner `"Firebase: Error (auth/invalid-api-key)."`; button remains visible (`276px x 44px`, `disabled: false`); `scrollWidth: 390` | Graceful error handling, zero crash | **PASS** |

---

## 3. PWA Manifest, Service Worker & Offline Reload (`REQ-002`, `REQ-003`)

- **Manifest (`GET /manifest.webmanifest`):** HTTP `200 OK` (`application/manifest+json; charset=utf-8`), `name: "MarombApp"`, `short_name: "Maromba"`, `display: "standalone"`, `theme_color: "#000e26"`, `background_color: "#000e26"`, icons `/icons/icon-192.png` (`200 OK`, `3,055` bytes) and `/icons/icon-512.png` (`200 OK`, `8,602` bytes).
- **Service Worker (`GET /sw.js`):** HTTP `200 OK` (`1,636` bytes), registered at scope `https://marombapp-serving-w3ei3fpeiq-uc.a.run.app/` with `activeState: "activated"`.
- **Offline Reload (`context.setOffline(true)`):**
  - `/`: HTTP `200` (`fromServiceWorker: true`), `<SignIn />` rendered, button `"Sign in with Google"` (`276px x 44px`), `scrollWidth: 390`.
  - `/plan`: HTTP `200` (`fromServiceWorker: true`), `<SignIn />` rendered, button `"Sign in with Google"` (`276px x 44px`), `scrollWidth: 390`.
  - `/in-gym`: HTTP `200` (`fromServiceWorker: true`), `<SignIn />` rendered, button `"Sign in with Google"` (`276px x 44px`), `scrollWidth: 390`.

---

## 4. Speculative AI UI & Bundle Security Check (`REQ-002`, `REQ-005`, `ADR-003`)

- **Client Bundle (`/assets/index-By6ZiK3q.js`, `335,186` bytes):**
  - Speculative AI workout generation/evaluation UI strings: **`0` found (`PASS`)**
  - Vertex AI SDK (`@google/genai`, `vertexai.googleapis.com`) in client bundle: **`0` found (`PASS`)**
  - Exposed GCP / Vertex AI credentials in client bundle: **`0` found (`PASS`)**
- **Health Endpoint (`GET /api/healthz`):**
  - HTTP `200` JSON: `{"status":"ok","revision":"marombapp-serving-00003-4vq","firestoreDatabase":"marombapp","aiReady":true}` (`PASS`)
