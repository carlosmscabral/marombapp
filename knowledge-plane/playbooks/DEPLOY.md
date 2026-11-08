# Cloud Run Deployment Playbook (`marombapp-serving`)

Covers packaging, deploying, verifying, and rolling back `marombapp-serving` on Cloud Run in `cabral-scion-hub` (`us-central1`) per REQ-003, REQ-004, ADR-001, and ADR-002.

## Service & IAM Topology

- **GCP Project:** `cabral-scion-hub` (`us-central1`)
- **Cloud Run Service:** `marombapp-serving` (`https://marombapp-serving-w3ei3fpeiq-uc.a.run.app`)
- **Runtime Service Account:** `marombapp-run@cabral-scion-hub.iam.gserviceaccount.com`
- **Cloud Build Service Account:** `projects/cabral-scion-hub/serviceAccounts/cabral-builder@cabral-scion-hub.iam.gserviceaccount.com`
- **Deployer Identity:** `cabral-agent@cabral-scion-hub.iam.gserviceaccount.com` (holds `roles/run.admin` on `marombapp-serving` and `roles/iam.serviceAccountUser` on both `marombapp-run@` and `cabral-builder@`)
- **Public Invoker Policy:** `allUsers` already holds `roles/run.invoker` on `marombapp-serving` (verified via `gcloud run services get-iam-policy marombapp-serving`), so `--allow-unauthenticated` is omitted from `gcloud run deploy` to avoid any IAM mutation call.
- **Firestore Database:** Named Native database `marombapp` (`projects/cabral-scion-hub/databases/marombapp`)

## Build Arguments vs. Runtime Environment

- **Build-time (`Dockerfile` `ARG`):**
  - `VITE_FIREBASE_API_KEY` (default `""`)
  - `VITE_FIREBASE_AUTH_DOMAIN` (default `""`)
  - `VITE_FIREBASE_PROJECT_ID` (default `""`)
  - `VITE_FIREBASE_APP_ID` (default `""`)
  - `VITE_FIREBASE_ALLOWED_UID` (default `""`)
  - `VITE_FIRESTORE_DATABASE_ID` (default `"marombapp"`)
- **Runtime environment (`--set-env-vars` at deploy time, never baked into the image):**
  - `FIRESTORE_DATABASE_ID=marombapp`
  - `GOOGLE_CLOUD_PROJECT=cabral-scion-hub`
  - `GOOGLE_CLOUD_LOCATION=global`
  - `FIREBASE_PROJECT_ID=<per PO #7>` (must equal the Firebase Auth project that issues ID tokens so `firebase-admin` verifies the expected audience, taking precedence over `GOOGLE_CLOUD_PROJECT`)
  - `ALLOWED_UID=iELlq0wRQhR2F5NmrM6pbMSrJuj1`

## Open Item (F1 — Pending PO Decision `#7`)

- **Propagating `VITE_FIREBASE_*` build arguments under `gcloud run deploy --source`:**
  - `gcloud run deploy --source` invokes Cloud Build (`gcr.io/cloud-builders/docker build`), and `--set-build-env-vars` is documented for Google Cloud Buildpacks rather than `Dockerfile` `ARG` values (unproven for `Dockerfile` builds).
  - For the interim Release 1 deploy (PO `#7` Option C), the `Dockerfile` default `ARG` values (`VITE_FIRESTORE_DATABASE_ID="marombapp"` and empty `VITE_FIREBASE_*`) are intentional for L1/L2 verification.
  - Once PO decision `#7` resolves the Firebase web app configuration, verify and standardize the build-arg delivery path before the full end-to-end release (either `gcloud builds submit --config=cloudbuild.yaml` passing `--build-arg VITE_FIREBASE_*=...` followed by `gcloud run deploy --image=...`, or staging a public web-config file in the clean archive directory `$d`) and confirm post-deploy by grepping the served JS bundle for the expected `VITE_FIREBASE_PROJECT_ID`.

## Step 1: Clean Archive Packaging

Never run `gcloud run deploy --source=/workspace` directly on a workspace checkout, and never archive `HEAD` of a feature branch. Fetch `origin` and export the verified `origin/factory/main` commit via `git archive` to a clean temporary directory:

```bash
git -C /workspace fetch origin && sha=$(git -C /workspace rev-parse origin/factory/main)
d=/tmp/deploy-$sha
rm -rf "$d" && mkdir -p "$d"
git -C /workspace archive "$sha" | tar -x -C "$d"
```

## Step 2: Deploy to Cloud Run & Route Traffic

Deploy from the clean archive directory with `--build-service-account` and `--service-account` (`FIREBASE_PROJECT_ID` must equal the Firebase Auth project per PO `#7`, or may be omitted during the interim Option C deploy when defaulting to `GOOGLE_CLOUD_PROJECT`):

```bash
gcloud run deploy marombapp-serving \
  --source="$d" \
  --project=cabral-scion-hub \
  --region=us-central1 \
  --service-account=marombapp-run@cabral-scion-hub.iam.gserviceaccount.com \
  --build-service-account=projects/cabral-scion-hub/serviceAccounts/cabral-builder@cabral-scion-hub.iam.gserviceaccount.com \
  --set-env-vars="FIRESTORE_DATABASE_ID=marombapp,GOOGLE_CLOUD_PROJECT=cabral-scion-hub,GOOGLE_CLOUD_LOCATION=global,FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID:?set per PO #7},ALLOWED_UID=iELlq0wRQhR2F5NmrM6pbMSrJuj1" \
  --quiet
```

`marombapp-serving` tracks `latestRevision: true` (`100%` traffic) by default, so `gcloud run deploy` routes 100% of traffic to the newly created revision automatically (note that `gcloud run deploy` in `gcloud` 589+ does not accept `--to-latest`). If traffic was previously pinned to a specific revision (for example after a rollback or `--no-traffic` deploy), unpin it to the latest revision with:

```bash
gcloud run services update-traffic marombapp-serving \
  --project=cabral-scion-hub \
  --region=us-central1 \
  --to-latest \
  --quiet
```

## Step 3: Post-Deploy L1 & L2 Verification

Immediately after rollout, verify all L1 and L2 contract checks against `SERVICE_URL`:

1. **L1 Health & PWA Assets:**
   - `GET /api/healthz` returns HTTP `200` with strict JSON `{"status":"ok","revision":"<revision>","firestoreDatabase":"marombapp","aiReady":true}`.
   - `GET /` returns HTTP `200` HTML (`index.html`).
   - `GET /manifest.webmanifest` returns HTTP `200` (`application/manifest+json`).
   - `GET /sw.js` returns HTTP `200` JavaScript service worker.
2. **L2 Contract Invariants:**
   - `GET /api/auth/session` (no `Authorization` header) returns HTTP `401` JSON.
   - `GET /api/auth/session` (`Authorization: Bearer invalid-token`) returns HTTP `401` JSON.
   - `POST /api/ai/workout` (no or invalid token) returns HTTP `401` JSON.
   - `GET /plan` (SPA client route) returns HTTP `200` `index.html`.
   - `GET /api/nope` (unknown API route) returns HTTP `404` JSON (never `index.html`).

## Step 4: Rollback Procedure

If any L1 or L2 check fails after deployment, immediately route 100% traffic back to the prior healthy revision listed in [../state/LIVE.md](../state/LIVE.md):

```bash
gcloud run services update-traffic marombapp-serving \
  --project=cabral-scion-hub \
  --region=us-central1 \
  --to-revisions="<ROLLBACK_REVISION>=100" \
  --quiet
```

## Step 5: Promote `LIVE.md`

After L1 and L2 checks pass, record the new live revision, rollback revision, source commit SHA, and UTC timestamp in [../state/LIVE.md](../state/LIVE.md), verify `python3 knowledge-plane/kp-check.py`, and commit via the commit slot.
