# Live Mobile PWA Ergonomics & UI Audit — `marombapp-serving-00002-89c` (`2f1f585be63f`)

- **Auditor:** `ui-auditor` (`marombapp-eval`)
- **Target Service:** `marombapp-serving` (`https://marombapp-serving-w3ei3fpeiq-uc.a.run.app`)
- **Live Revision:** `marombapp-serving-00002-89c` (Source commit: `2f1f585be63f4957adbacc7bb503281a931547f0`)
- **Audit Viewport:** `390x844` (`deviceScaleFactor: 3`, mobile touch enabled, headless `/usr/bin/chromium`)
- **Audited At (UTC):** `2026-11-08T04:55:23Z` – `2026-11-08T05:02:03Z`
- **Cited Specifications:** `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`, `REQ-005`, `ADR-001`, `ADR-003`, `invariants.md` (Rules 2 & 3)

---

## Executive Verdict

- **PWA Shell, Viewport Overflow (`390x844`), Manifest, Service Worker & Offline Precache (`REQ-002`, `REQ-003`, `ADR-001`):** **PASS**
  - All 7 SPA routes (`/`, `/plan`, `/library`, `/in-gym`, `/analytics`, `/start`, `/sessions/123`) return HTTP `200 OK` (`text/html; charset=utf-8`) with `document.documentElement.scrollWidth === 390` (zero horizontal overflow).
  - `/manifest.webmanifest` (`200 OK`), `/icons/icon-192.png` (`200 OK`), `/icons/icon-512.png` (`200 OK`), and `/sw.js` (`200 OK`) register and activate cleanly (`workbox-precache-v2` caches all 11 static shell assets and serves `/`, `/plan`, and `/in-gym` with HTTP `200` when offline).
- **Zero Speculative AI UI & Client Bundle Secret Hygiene (`REQ-002`, `REQ-005`, `ADR-003`, Invariants 2 & 3):** **PASS**
  - Zero unrequested AI workout generation or evaluation screens, buttons, or routes exist in the DOM or client bundle (`/assets/index-DFAJFhxm.js`). Zero Vertex AI SDK imports or GCP credentials are present in client assets.
- **Unauthenticated Auth Gate Rendering & Touch Targets (`REQ-001`, `REQ-002`, `REQ-004`):** **FAIL (Blank `#root` on live unconfigured build; `SignIn` component touch targets `276px x 44px` PASS when rendered)**
  - **Live Runtime Finding:** Because `marombapp-serving-00002-89c` was built with default `ARG VITE_FIREBASE_API_KEY=""` (pending PO decision issue `#7`) and `AuthProvider` in `src/lib/auth.tsx` (line 40) calls `getFirebaseAuth()` inside `useEffect` without a `try/catch` guard, Firebase throws an uncaught synchronous `FirebaseError: Firebase: Error (auth/invalid-api-key).` during effect execution. In React 19, this uncaught error unmounts `#root` completely, leaving a blank `#000e26` screen across all routes (`controls: []`, `headings: []`) instead of transitioning `loading -> false` and rendering `<SignIn />`.
  - **Component Ergonomics Verification:** Wrapping `getFirebaseAuth()` in `try/catch` inside `AuthProvider`'s `useEffect` immediately restores the `<SignIn />` gate on `390x844` with zero overflow (`scrollWidth: 390`), rendering the `"Sign in with Google"` button at **`276px x 44px`** (`>= 44px` touch target requirement) and **`6.85:1`** WCAG contrast.

---

## 1. Viewport & Horizontal Overflow Audit (`390x844` — `REQ-002`, `REQ-003`)

All routes were loaded in headless Chromium (`/usr/bin/chromium`) configured at `390x844` (`deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`).

| Route | HTTP Status | Content-Type | `clientWidth` | `scrollWidth` | `body.scrollWidth` | Overflowing Elements (`>390px`) | Result |
|---|---|---|---|---|---|---|---|
| `/` | `200` | `text/html; charset=utf-8` | `390` | `390` | `390` | `0` | **PASS** |
| `/plan` | `200` | `text/html; charset=utf-8` | `390` | `390` | `390` | `0` | **PASS** |
| `/library` | `200` | `text/html; charset=utf-8` | `390` | `390` | `390` | `0` | **PASS** |
| `/in-gym` | `200` | `text/html; charset=utf-8` | `390` | `390` | `390` | `0` | **PASS** |
| `/analytics` | `200` | `text/html; charset=utf-8` | `390` | `390` | `390` | `0` | **PASS** |
| `/start` | `200` | `text/html; charset=utf-8` | `390` | `390` | `390` | `0` | **PASS** |
| `/sessions/123` | `200` | `text/html; charset=utf-8` | `390` | `390` | `390` | `0` | **PASS** |

- **HTML Metadata Checks:**
  - `<html lang="en">` present.
  - `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` present.
  - `<meta name="theme-color" content="#000e26">` matches `manifest.webmanifest`.

---

## 2. PWA Manifest, Service Worker & Offline Reload (`REQ-002`, `REQ-003`)

### 2.1 Web App Manifest (`/manifest.webmanifest`)
- **HTTP Status:** `200 OK` (`Content-Type: application/manifest+json; charset=utf-8`)
- **Fields Verified:**
  - `name`: `"MarombApp"`
  - `short_name`: `"Maromba"`
  - `description`: `"Single-user gym tracker"`
  - `start_url`: `"/"`
  - `scope`: `"/"`
  - `display`: `"standalone"`
  - `orientation`: `"portrait"`
  - `background_color`: `"#000e26"`
  - `theme_color`: `"#000e26"`
- **Icons Verified:**
  - `/icons/icon-192.png` (`192x192`, `image/png`, `purpose: "any maskable"`) — HTTP `200 OK` (`3,055` bytes)
  - `/icons/icon-512.png` (`512x512`, `image/png`, `purpose: "any maskable"`) — HTTP `200 OK` (`8,602` bytes)

### 2.2 Service Worker Registration & Offline Reload (`/sw.js`)
- **Script Response:** `GET /sw.js` -> HTTP `200 OK` (`application/javascript; charset=utf-8`, `1,636` bytes, Workbox `precacheAndRoute` enabled).
- **Live Registration State:**
  - `scope`: `https://marombapp-serving-w3ei3fpeiq-uc.a.run.app/`
  - `activeState`: `"activated"`
  - `scriptURL`: `https://marombapp-serving-w3ei3fpeiq-uc.a.run.app/sw.js`
  - `cacheKeys`: `["workbox-precache-v2-https://marombapp-serving-w3ei3fpeiq-uc.a.run.app/"]` (11 precached URLs: `index.html`, `manifest.webmanifest`, `registerSW.js`, `icons/icon-192.png`, `icons/icon-512.png`, `assets/index-DJxMxZYR.css`, `assets/index-DFAJFhxm.js`, `assets/firebase-firestore-kjHBEHGr.js`, `assets/firebase-auth-5xDtBWTY.js`, `assets/charts-CyQaC5Dm.js`, `assets/Analytics-Cv4uwO55.js`).
- **Offline Reload (`context.setOffline(true)`):**
  - Reloading `/`, `/plan`, and `/in-gym` while offline succeeded with HTTP `200` served from Service Worker (`fromServiceWorker: true`), preserving `document.title === "MarombApp"`, `#root`, and `scrollWidth === 390`.

---

## 3. Touch Targets, Accessibility & Live Auth Gate Defect (`REQ-001`, `REQ-002`, `REQ-004`)

### 3.1 Defect Finding: Uncaught `auth/invalid-api-key` Unmounts `#root` When `VITE_FIREBASE_API_KEY` Is Unset
- **Observed Behavior on Live Revision `marombapp-serving-00002-89c`:**
  - Every route throws an uncaught page error: `FirebaseError: Firebase: Error (auth/invalid-api-key).`
  - React 19 unmounts `#root` (`document.querySelector('#root').innerHTML === ""`), leaving a solid `#000e26` background with `0` interactive controls rendered.
- **Root Cause (`src/lib/auth.tsx` lines 39–57 & 64–92):**
  - `Dockerfile` defaults `ARG VITE_FIREBASE_API_KEY=""` when built without Firebase client build arguments (pending PO issue `#7`).
  - In `src/lib/auth.tsx`, `AuthProvider` calls `const auth = getFirebaseAuth();` inside `useEffect(() => { ... }, [])` without a `try/catch` block (and likewise calls `getFirebaseAuth()` outside `try` in `signIn()` and `signOut()`).
  - When `VITE_FIREBASE_API_KEY` is empty or invalid, `getAuth(getFirebaseApp())` throws synchronously inside `useEffect`, crashing the React tree instead of setting `setError(...)` and `setLoading(false)` so `<Gate />` can render `<SignIn />`.
- **Recommended Fix for Build Team:**
  - Guard `getFirebaseAuth()` inside `AuthProvider`'s `useEffect` (and inside `signIn` / `signOut`) with `try { ... } catch (err) { setError((err as Error).message || 'Firebase configuration unavailable'); setLoading(false); }` so `<SignIn />` always renders gracefully even when build-time Firebase credentials are absent or invalid.

### 3.2 `<SignIn />` Touch Target & Accessibility Measurements at `390x844`
When `AuthProvider`'s `useEffect` catches the `getFirebaseAuth()` error and sets `loading = false`, `<SignIn />` renders cleanly on `390x844`:

| Element | Selector / Role | Text / Accessible Label | Bounding Box (`W x H`) | Position (`left, top`) | Touch Target (`>=44px`) | Foreground / Background | WCAG Contrast |
|---|---|---|---|---|---|---|---|
| Primary CTA Button | `button[type="button"]` | `"Sign in with Google"` | **`276px x 44px`** | `(57px, 522px)` | **PASS** (`276 >= 44`, `44 >= 44`) | `rgb(0, 48, 85)` on `rgb(106, 178, 255)` | **`6.85:1`** (AA/AAA Pass) |
| App Title | `h1` | `"MarombApp"` | `176px x 36px` | `(107px, 382px)` | N/A (Non-interactive) | `rgb(219, 229, 255)` on `rgb(4, 22, 51)` | **`14.80:1`** (AAA Pass) |

---

## 4. Speculative AI UI & Bundle Security Check (`REQ-002`, `REQ-005`, `ADR-003`)

| Check | Scope | Finding | Result |
|---|---|---|---|
| Unrequested AI workout generation / evaluation UI | DOM across all 7 routes + `/assets/index-DFAJFhxm.js` (`334,666` bytes) | `0` matches for AI generation/evaluation headings, buttons, or routes | **PASS** |
| Vertex AI SDK bundled in client | `/assets/index-DFAJFhxm.js` and chunk imports | `0` references to `@google/genai` or `vertexai.googleapis.com` | **PASS** |
| Exposed GCP / Vertex AI credentials | All client JS/CSS assets and HTML responses | `0` service account keys or Vertex secrets in client bundle | **PASS** |
| Health endpoint contract | `GET /api/healthz` | HTTP `200` JSON `{"status":"ok","revision":"marombapp-serving-00002-89c","firestoreDatabase":"marombapp","aiReady":true}` | **PASS** |
