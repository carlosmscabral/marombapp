# Invariants

Every change MUST keep these rules. The reviewer checks each one and cites the rule number in a FAIL verdict.

1. MUST keep all entrypoints `<=200` lines and all other code files `<=300` lines with acyclic imports and Why-focused ASD-STE100 docstrings/comments.
2. MUST verify Firebase ID token `ALLOWED_UID` on every protected `/api/*` route before any I/O or Vertex AI call, and MUST embed zero GCP/Vertex secrets in client bundles.
3. MUST preserve 100% as-is workout, offline Firestore cache, and `sessionStorage` sticky `RestBar` behavior without shipping speculative AI UI before explicit PO GitHub issues.
4. MUST pass `npm run lint`, `npm run build`, and `npm test` (with real assertions, zero green-mock bypasses) and rebase onto `origin/factory/main` before requesting review.
