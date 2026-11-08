# Live Mobile PWA Ergonomics & UI Audit (`#12`) — `marombapp-serving-00004-cjq` (`d95555facbbd`)

- **Auditor:** `ui-auditor` (`marombapp-eval`)
- **Target Service:** `marombapp-serving` (`https://marombapp-serving-280799742875.us-central1.run.app` in `vibe-cabral`)
- **Live Revision:** `marombapp-serving-00004-cjq` (Source commit: `d95555facbbd97abc7b5b64858179687a5975958`, shipping `#12`)
- **Audit Viewport:** `390x844` (`deviceScaleFactor: 3`, mobile touch enabled, headless `/usr/bin/chromium`)
- **Audited At (UTC):** `2026-11-08T15:07:43Z` – `2026-11-08T15:08:14Z`
- **Cited Specifications:** `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`, `REQ-005`, `ADR-001`, `ADR-003`, `ADR-004`, `invariants.md` (Rules 2 & 3)

---

## Executive Verdict: **PASS (All Checks Verified on Unpatched Live Revision `marombapp-serving-00004-cjq` in `vibe-cabral`)**

1. **Live 7-Route Rendering, Zero `pageErrors`, & Live `vibe-cabral` OAuth Flow (`REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`, `ADR-004`, `#12`):** **PASS**
   - Across all 7 routes (`/`, `/plan`, `/library`, `/in-gym`, `/analytics`, `/start`, `/sessions/123`), HTTP status is `200`, `pageErrors` is `[]` (`0` uncaught exceptions), and `<SignIn />` mounts and renders cleanly on initial load with zero error banners (`hasInvalidApiKeyBanner: false`, `alertText: null`).
   - Clicking `"Sign in with Google"` on the live deployment triggers `0` uncaught exceptions (`pageErrors: []`), shows no `auth/invalid-api-key` banner (`hasInvalidApiKeyBanner: false`), and initiates the real `vibe-cabral` Google OAuth popup flow (`https://vibe-cabral.firebaseapp.com/__/auth/handler?...&authType=signInViaPopup`) while preserving button interactivity (`276px x 44px`, `disabled: false`) and `scrollWidth === 390`.
2. **Viewport Overflow (`390x844`) & Touch Target Ergonomics (`REQ-001`, `REQ-002`, `REQ-003`):** **PASS**
   - Every SPA route renders with `document.documentElement.scrollWidth === 390` (`0` overflowing elements).
   - Primary CTA button `"Sign in with Google"` measures **`276px x 44px`** at `(57px, 488px)` (`>= 44px` height and width gym touch target requirement) with **`6.07:1`** WCAG AA contrast (`rgb(0, 48, 85)` on `rgb(106, 178, 255)`), and heading `"MarombApp"` (`h1`) achieves **`14.69:1`** WCAG AAA contrast (`rgb(219, 229, 255)` on `rgb(0, 19, 47)` / `14.80:1` on card `rgb(4, 22, 51)`).
3. **PWA Manifest, Service Worker & Offline Reload (`REQ-002`, `REQ-003`, `ADR-001`):** **PASS**
   - `/manifest.webmanifest` (`200 OK`), `/icons/icon-192.png` (`200 OK`), `/icons/icon-512.png` (`200 OK`), and `/sw.js` (`200 OK`, `activeState: "activated"`) precache the static app shell.
   - Offline reload (`context.setOffline(true)`) on `/`, `/plan`, and `/in-gym` serves HTTP `200` from Service Worker (`fromServiceWorker: true`) with `pageErrors: []` and renders `<SignIn />` with the `"Sign in with Google"` button (`276px x 44px`) and `scrollWidth === 390`.
4. **No Speculative AI UI & Bundle Secret Hygiene (`REQ-002`, `REQ-005`, `ADR-003`, `ADR-004`, Invariants 2 & 3):** **PASS**
   - Zero unrequested AI workout generation/evaluation screens or buttons in the DOM or `/assets/index-DPvCE-m1.js` (`337,066` bytes); zero Vertex AI SDK imports (`@google/genai`) or GCP service-account keys in client assets.
   - Confirmed expected `vibe-cabral` Firebase web configuration compiled into `/assets/index-DPvCE-m1.js` (`VITE_FIREBASE_API_KEY` present, `VITE_FIREBASE_AUTH_DOMAIN=vibe-cabral.firebaseapp.com`, `VITE_FIREBASE_PROJECT_ID=vibe-cabral`, `VITE_FIREBASE_APP_ID=1:280799742875:web:e47e00f1afcdab5e92af3e`, `VITE_FIREBASE_ALLOWED_UID=iELlq0wRQhR2F5NmrM6pbMSrJuj1`, `VITE_FIRESTORE_DATABASE_ID=marombapp`).

---

## 1. Live Route Rendering, Page Errors & Overflow (`390x844` — `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`)

All 7 routes were audited directly against `https://marombapp-serving-280799742875.us-central1.run.app` without any script interception.

| Route | HTTP Status | Uncaught `pageErrors` | `auth/invalid-api-key` Banner | Rendered Heading (`h1`) | Rendered CTA Button (`W x H`) | `scrollWidth` (`<=390`) | Overflowing Elements | Result |
|---|---|---|---|---|---|---|---|---|
| `/` | `200` | `0` (`[]`) | `None` (`false`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/plan` | `200` | `0` (`[]`) | `None` (`false`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/library` | `200` | `0` (`[]`) | `None` (`false`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/in-gym` | `200` | `0` (`[]`) | `None` (`false`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/analytics` | `200` | `0` (`[]`) | `None` (`false`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/start` | `200` | `0` (`[]`) | `None` (`false`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/sessions/123` | `200` | `0` (`[]`) | `None` (`false`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |

---

## 2. Touch Targets, Accessibility & Sign-In Click Verification (`REQ-001`, `REQ-002`, `REQ-004`, `ADR-004`)

| Element / Action | Measurement / Observation | Requirement | Result |
|---|---|---|---|
| `"Sign in with Google"` (`button[type="button"]`) | Bounding box: **`276px x 44px`** at `(57px, 488px)`, `borderRadius: 12px` | `>= 44px` height & width | **PASS** |
| Button Typography & Contrast | `14px` (`font-weight: 600`), `rgb(0, 48, 85)` on `rgb(106, 178, 255)` -> **`6.07:1`** (WCAG 2.1 luminance) | WCAG AA (`>= 4.5:1`) | **PASS** |
| Heading `"MarombApp"` (`h1`) | `30px` (`font-weight: 600`), `rgb(219, 229, 255)` on `rgb(0, 19, 47)` / `rgb(4, 22, 51)` -> **`14.69:1` / `14.80:1`** | WCAG AAA (`>= 7.0:1`) | **PASS** |
| Initial Load Error Banner Check | `alertText: null`, `hasInvalidApiKeyBanner: false`; zero `"Firebase: Error (auth/invalid-api-key)."` banner on initial load | Valid Firebase web config in `vibe-cabral` | **PASS** |
| Clicking `"Sign in with Google"` (live `vibe-cabral` Firebase Auth) | `0` uncaught errors (`pageErrors: []`); `hasInvalidApiKeyBanner: false`; opens real OAuth popup to `https://vibe-cabral.firebaseapp.com/__/auth/handler?...&authType=signInViaPopup`; button remains visible (`276px x 44px`, `disabled: false`); `scrollWidth: 390` | Real `vibe-cabral` OAuth handler & zero crash | **PASS** |

---

## 3. PWA Manifest, Service Worker & Offline Reload (`REQ-002`, `REQ-003`, `ADR-001`)

- **Manifest (`GET /manifest.webmanifest`):** HTTP `200 OK` (`application/manifest+json; charset=utf-8`, `419` bytes), `name: "MarombApp"`, `short_name: "Maromba"`, `display: "standalone"`, `theme_color: "#000e26"`, `background_color: "#000e26"`, icons `/icons/icon-192.png` (`200 OK`, `3,055` bytes) and `/icons/icon-512.png` (`200 OK`, `8,602` bytes).
- **Service Worker (`GET /sw.js`):** HTTP `200 OK` (`1,638` bytes), registered at scope `https://marombapp-serving-280799742875.us-central1.run.app/` with `activeState: "activated"`.
- **Offline Reload (`context.setOffline(true)`):**
  - `/`: HTTP `200` (`fromServiceWorker: true`), `pageErrors: []`, `<SignIn />` rendered, button `"Sign in with Google"` (`276px x 44px`), `scrollWidth: 390`.
  - `/plan`: HTTP `200` (`fromServiceWorker: true`), `pageErrors: []`, `<SignIn />` rendered, button `"Sign in with Google"` (`276px x 44px`), `scrollWidth: 390`.
  - `/in-gym`: HTTP `200` (`fromServiceWorker: true`), `pageErrors: []`, `<SignIn />` rendered, button `"Sign in with Google"` (`276px x 44px`), `scrollWidth: 390`.

---

## 4. Speculative AI UI & Bundle Security Check (`REQ-002`, `REQ-005`, `ADR-003`, `ADR-004`, Invariants 2 & 3)

- **Client Bundles (`/assets/index-DPvCE-m1.js` `337,066` bytes, `/assets/charts-CyQaC5Dm.js` `392,265` bytes, `/assets/firebase-auth-5xDtBWTY.js` `213,031` bytes, `/assets/firebase-firestore-kjHBEHGr.js` `347,631` bytes):**
  - Speculative AI workout generation/evaluation UI strings: **`0` found (`PASS`)**
  - Vertex AI SDK (`@google/genai`, `vertexai.googleapis.com`) in client bundles: **`0` found (`PASS`)**
  - Exposed GCP / Vertex AI service-account credentials (`PRIVATE_KEY`, `client_secret`) in client bundles: **`0` found (`PASS`)**
  - Expected `vibe-cabral` Firebase web config in `/assets/index-DPvCE-m1.js`:
    - `VITE_FIREBASE_API_KEY`: present (`AIzaSy...` web key) (`PASS`)
    - `VITE_FIREBASE_AUTH_DOMAIN`: `"vibe-cabral.firebaseapp.com"` (`PASS`)
    - `VITE_FIREBASE_PROJECT_ID`: `"vibe-cabral"` (`PASS`)
    - `VITE_FIREBASE_APP_ID`: `"1:280799742875:web:e47e00f1afcdab5e92af3e"` (`PASS`)
    - `VITE_FIREBASE_ALLOWED_UID`: `"iELlq0wRQhR2F5NmrM6pbMSrJuj1"` (`PASS`)
    - `VITE_FIRESTORE_DATABASE_ID`: `"marombapp"` (`PASS`)
- **Health Endpoint (`GET /api/healthz`):**
  - HTTP `200` JSON: `{"status":"ok","revision":"marombapp-serving-00004-cjq","firestoreDatabase":"marombapp","aiReady":true}` (`PASS`)
