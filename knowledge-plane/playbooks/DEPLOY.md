# Cloud Run Deployment Playbook (`marombapp-serving`)

Covers packaging, deploying, verifying, and rolling back `marombapp-serving` on Cloud Run in `cabral-scion-hub` (`us-central1`) per REQ-003, REQ-004, ADR-001, and ADR-002.

## Service & IAM Topology

- **GCP Project:** `cabral-scion-hub` (`us-central1`)
- **Cloud Run Service:** `marombapp-serving` (`https://marombapp-serving-w3ei3fpeiq-uc.a.run.app`)
- **Runtime Service Account:** `marombapp-run@cabral-scion-hub.iam.gserviceaccount.com`
- **Cloud Build Service Account:** `projects/cabral-scion-hub/serviceAccounts/cabral-builder@cabral-scion-hub.iam.gserviceaccount.com`
- **Deployer Identity:** `cabral-agent@cabral-scion-hub.iam.gserviceaccount.com` (holds `roles/run.admin` on `marombapp-serving` and `roles/iam.serviceAccountUser` on both `marombapp-run@` and `cabral-builder@`)
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
  - `FIREBASE_PROJECT_ID=<firebase-auth-project-id>` (when distinct from `GOOGLE_CLOUD_PROJECT`)
  - `ALLOWED_UID=iELlq0wRQhR2F5NmrM6pbMSrJuj1`

## Step 1: Clean Archive Packaging

Never run `gcloud run deploy --source=/workspace` directly on a workspace checkout. Export the verified `factory/main` commit via `git archive` to a clean temporary directory:

```bash
sha=$(git -C /workspace rev-parse HEAD)
d=/tmp/deploy-$sha
rm -rf "$d" && mkdir -p "$d"
git -C /workspace archive "$sha" | tar -x -C "$d"
```

## Step 2: Deploy to Cloud Run (`--to-latest`)

Deploy from the clean archive directory with `--build-service-account`, `--service-account`, and `--to-latest`:

```bash
gcloud run deploy marombapp-serving \
  --source="$d" \
  --project=cabral-scion-hub \
  --region=us-central1 \
  --service-account=marombapp-run@cabral-scion-hub.iam.gserviceaccount.com \
  --build-service-account=projects/cabral-scion-hub/serviceAccounts/cabral-builder@cabral-scion-hub.iam.gserviceaccount.com \
  --set-env-vars="FIRESTORE_DATABASE_ID=marombapp,GOOGLE_CLOUD_PROJECT=cabral-scion-hub,GOOGLE_CLOUD_LOCATION=global,ALLOWED_UID=iELlq0wRQhR2F5NmrM6pbMSrJuj1" \
  --to-latest \
  --allow-unauthenticated \
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
