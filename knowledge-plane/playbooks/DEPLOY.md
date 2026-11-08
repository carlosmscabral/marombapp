# Cloud Run Deployment Playbook (`marombapp-serving`)

Covers packaging, building, deploying, verifying, and rolling back `marombapp-serving` on Cloud Run and the isolated `marombapp` Firestore Native database in `vibe-cabral` (`us-central1`) per REQ-002, REQ-003, REQ-004, [ADR-001](../adr/ADR-001-unified-cloud-run-bff-static-pwa-serving.md), and [ADR-004](../adr/ADR-004-co-locate-hub-runtime-and-named-db-in-vibe-cabral.md).

## Service & IAM Topology

- **GCP Project:** `vibe-cabral` (project number `280799742875`, region `us-central1`)
- **Cloud Run Service:** `marombapp-serving` (`https://marombapp-serving-280799742875.us-central1.run.app`, also `https://marombapp-serving-yozowz6hla-uc.a.run.app`)
- **Artifact Registry Repository:** `us-central1-docker.pkg.dev/vibe-cabral/marombapp`
- **Runtime Service Account:** `marombapp-run@vibe-cabral.iam.gserviceaccount.com`
- **Cloud Build Service Account:** `projects/vibe-cabral/serviceAccounts/vibe-builder@vibe-cabral.iam.gserviceaccount.com` (pass explicitly on every `gcloud builds submit`; default compute SA has no grants)
- **Deployer Identity:** `marombapp-deployer@vibe-cabral.iam.gserviceaccount.com` (holds `roles/run.developer` + service-scoped `roles/run.admin` on `marombapp-serving`, `roles/cloudbuild.builds.editor`, `roles/artifactregistry.writer`, `roles/datastore.indexAdmin`, `roles/firebaserules.admin`, `roles/firebase.viewer`, and `roles/iam.serviceAccountUser` on `marombapp-run@` and `vibe-builder@`)
- **Firestore Database & Firebase Config:**
  - Named Native database `marombapp` (`projects/vibe-cabral/databases/marombapp`).
  - **HARD RULE ([ADR-004](../adr/ADR-004-co-locate-hub-runtime-and-named-db-in-vibe-cabral.md)):** NEVER deploy rules or indexes to, or write test/evaluation data into, `(default)` (live personal workout history). NEVER run a bare `firebase deploy` (which would hit Firebase Hosting `vibe-cabral.web.app`).
  - [`firebase.json`](../../firebase.json) uses the array form for `firestore` with `"database": "marombapp"`.
  - [`.firebaserc`](../../.firebaserc) sets `"default": "vibe-cabral"`. Always pass `--only firestore:marombapp --project vibe-cabral`.

## Step 0: Identity Verification

Before any build or deploy operation, verify the active `gcloud` identity:

```bash
gcloud auth list --filter=status:ACTIVE --format="value(account)" --quiet
gcloud config get-value account --quiet
```

The active account MUST be `marombapp-deployer@vibe-cabral.iam.gserviceaccount.com`. Stop and escalate to `lead` if it does not match.

## Build Arguments vs. Runtime Environment

- **Build-time (`Dockerfile` `ARG` passed via Cloud Build):**
  - `VITE_FIREBASE_API_KEY` (from injected env or `firebase apps:sdkconfig web 1:280799742875:web:e47e00f1afcdab5e92af3e --project vibe-cabral --json`)
  - `VITE_FIREBASE_AUTH_DOMAIN="vibe-cabral.firebaseapp.com"`
  - `VITE_FIREBASE_PROJECT_ID="vibe-cabral"`
  - `VITE_FIREBASE_APP_ID="1:280799742875:web:e47e00f1afcdab5e92af3e"`
  - `VITE_FIREBASE_ALLOWED_UID="iELlq0wRQhR2F5NmrM6pbMSrJuj1"`
  - `VITE_FIRESTORE_DATABASE_ID="marombapp"`
- **Runtime environment (`--set-env-vars` at deploy time, never baked into the image):**
  - `FIRESTORE_DATABASE_ID=marombapp`
  - `GOOGLE_CLOUD_PROJECT=vibe-cabral`
  - `FIREBASE_PROJECT_ID=vibe-cabral`
  - `GOOGLE_CLOUD_LOCATION=global`
  - `ALLOWED_UID=iELlq0wRQhR2F5NmrM6pbMSrJuj1`

## Firestore Rules & Composite Indexes (`database: marombapp`)

1. **Confirm [`firestore.rules`](../../firestore.rules) single-UID guard (`iELlq0wRQhR2F5NmrM6pbMSrJuj1`) and deploy only `firestore:marombapp`:**
   ```bash
   firebase deploy --only firestore:marombapp --project vibe-cabral --non-interactive
   ```
2. **Verify composite index (`sessions`: `status` ASC, `finishedAt` DESC) and rules release on `marombapp` (and confirm `(default)` is untouched):**
   ```bash
   gcloud firestore indexes composite list \
     --project=vibe-cabral \
     --database=marombapp \
     --format=json \
     --quiet

   curl -sf \
     -H "Authorization: Bearer $(gcloud auth print-access-token)" \
     "https://firebaserules.googleapis.com/v1/projects/vibe-cabral/releases/cloud.firestore/marombapp"
   ```

## Step 1: Clean Archive Packaging

Never run `gcloud builds submit` or `gcloud run deploy --source=/workspace` directly on a workspace checkout, and never archive `HEAD` of an unpushed branch. Fetch `origin` and export the verified `origin/factory/main` commit via `git archive` to a clean temporary directory:

```bash
git -C /workspace fetch origin && sha=$(git -C /workspace rev-parse origin/factory/main)
d=/tmp/deploy-$sha
rm -rf "$d" && mkdir -p "$d"
git -C /workspace archive "$sha" | tar -x -C "$d"
```

## Step 2: Build Image with Cloud Build (`vibe-builder` SA)

Resolve the `vibe-cabral` Firebase web config from environment variables (or `firebase apps:sdkconfig web 1:280799742875:web:e47e00f1afcdab5e92af3e --project vibe-cabral --json`), write a temporary Cloud Build config outside `$d` under `/tmp`, and submit the clean archive directory `$d`:

```bash
IMAGE="us-central1-docker.pkg.dev/vibe-cabral/marombapp/marombapp-serving:${sha}"
cat > "/tmp/cloudbuild-${sha}.yaml" <<'EOF'
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg=VITE_FIREBASE_API_KEY=${_VITE_FIREBASE_API_KEY}'
      - '--build-arg=VITE_FIREBASE_AUTH_DOMAIN=${_VITE_FIREBASE_AUTH_DOMAIN}'
      - '--build-arg=VITE_FIREBASE_PROJECT_ID=${_VITE_FIREBASE_PROJECT_ID}'
      - '--build-arg=VITE_FIREBASE_APP_ID=${_VITE_FIREBASE_APP_ID}'
      - '--build-arg=VITE_FIREBASE_ALLOWED_UID=${_VITE_FIREBASE_ALLOWED_UID}'
      - '--build-arg=VITE_FIRESTORE_DATABASE_ID=marombapp'
      - '-t'
      - '${_IMAGE}'
      - '.'
images:
  - '${_IMAGE}'
options:
  logging: CLOUD_LOGGING_ONLY
EOF

gcloud builds submit "$d" \
  --project=vibe-cabral \
  --region=us-central1 \
  --config="/tmp/cloudbuild-${sha}.yaml" \
  --service-account="projects/vibe-cabral/serviceAccounts/vibe-builder@vibe-cabral.iam.gserviceaccount.com" \
  --substitutions="_IMAGE=${IMAGE},_VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY:?VITE_FIREBASE_API_KEY is required},_VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN:-vibe-cabral.firebaseapp.com},_VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID:-vibe-cabral},_VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID:-1:280799742875:web:e47e00f1afcdab5e92af3e},_VITE_FIREBASE_ALLOWED_UID=${VITE_FIREBASE_ALLOWED_UID:-iELlq0wRQhR2F5NmrM6pbMSrJuj1}" \
  --quiet
```

## Step 3: Deploy to Cloud Run & Route Traffic

Deploy the built Artifact Registry image to `marombapp-serving` under `marombapp-run@vibe-cabral.iam.gserviceaccount.com`:

```bash
gcloud run deploy marombapp-serving \
  --image="$IMAGE" \
  --project=vibe-cabral \
  --region=us-central1 \
  --service-account=marombapp-run@vibe-cabral.iam.gserviceaccount.com \
  --set-env-vars="FIRESTORE_DATABASE_ID=marombapp,GOOGLE_CLOUD_PROJECT=vibe-cabral,FIREBASE_PROJECT_ID=vibe-cabral,GOOGLE_CLOUD_LOCATION=global,ALLOWED_UID=iELlq0wRQhR2F5NmrM6pbMSrJuj1" \
  --quiet
```

Unconditionally route 100% of traffic to the latest revision after every deploy so any traffic pin left by a prior rollback is cleared:

```bash
gcloud run services update-traffic marombapp-serving \
  --project=vibe-cabral \
  --region=us-central1 \
  --to-latest \
  --quiet
```

## Step 4: Post-Deploy L1 & L2 Verification

Immediately after rollout, verify all L1 and L2 contract checks against `https://marombapp-serving-280799742875.us-central1.run.app`:

1. **L1 Health, Traffic & PWA Assets:**
   - `gcloud run services describe marombapp-serving --project=vibe-cabral --region=us-central1 --format="json(status.traffic)" --quiet` shows `latestRevision: true` at `percent: 100`.
   - `GET /api/healthz` returns HTTP `200` with strict JSON `{"status":"ok","revision":"<revision>","firestoreDatabase":"marombapp","aiReady":true}`.
   - `GET /` returns HTTP `200` HTML (`index.html`).
   - `GET /manifest.webmanifest` returns HTTP `200` (`application/manifest+json`).
   - `GET /sw.js` returns HTTP `200` JavaScript service worker.
   - Load `/` at `390x844` in headless Playwright and verify the SignIn screen renders with `0` page errors and no `auth/invalid-api-key`, and verify the served JS bundle contains the `vibe-cabral` Firebase web config and zero service-account or Vertex AI credentials.
2. **L2 Contract Invariants:**
   - `GET /api/auth/session` (no `Authorization` header) returns HTTP `401` JSON.
   - `GET /api/auth/session` (`Authorization: Bearer invalid-token`) returns HTTP `401` JSON.
   - `POST /api/ai/workout` (no or invalid token) returns HTTP `401` JSON.
   - `GET /plan` (SPA client route) returns HTTP `200` `index.html`.
   - `GET /api/nope` (unknown API route) returns HTTP `404` JSON (never `index.html`).

## Step 5: Rollback Procedure

If any L1 or L2 check fails after deployment, immediately route 100% traffic back to the prior healthy revision listed in [../state/LIVE.md](../state/LIVE.md):

```bash
gcloud run services update-traffic marombapp-serving \
  --project=vibe-cabral \
  --region=us-central1 \
  --to-revisions="<ROLLBACK_REVISION>=100" \
  --quiet
```

## Step 6: Promote `LIVE.md`

After L1 and L2 checks pass, record the new live revision, rollback revision, source commit SHA, and UTC timestamp in [../state/LIVE.md](../state/LIVE.md), verify `python3 /workspace/knowledge-plane/kp-check.py`, and commit via the commit slot.
