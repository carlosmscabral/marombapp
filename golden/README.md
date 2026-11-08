# Golden data (evaluation team only)

This directory belongs to the evaluation project (`marombapp-eval`). Copy it into the evaluation
workspace, never into the build workspace or the build knowledge plane, so the build team can't tune the product to
the test set.

- **Metric:** `as_is_functional_parity_pass_rate` with a target of `1.0` or higher.
- **Probe:** End-to-end 390x844 Playwright parity suite verifying 100% of existing MarombApp flows (Auth gate, 66-exercise seed + custom Library CRUD, Plan & PlanDay ordering/targets, InGym active session set logging + persistent rest timer across reload + last-3-executions progressive overload display, Analytics charts, and SessionDetail) plus static AST/line-count verification (<=300 lines per module, <=200 lines per entrypoint).

Store each dataset as a versioned file (for example, `golden-v1.jsonl`), and record the version in every evaluation
run. The evaluation team reads the build team's knowledge plane read-only at `/scion-volumes/knowledge-plane`.
