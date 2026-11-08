#!/usr/bin/env python3
"""Check a Scion factory knowledge plane for broken links and unknown REQ-/ADR- IDs.

Usage: python3 knowledge-plane/kp-check.py [KNOWLEDGE_PLANE_DIR]
Exit code 0 when every reference resolves, 1 otherwise.
"""
import re
import sys
from pathlib import Path

LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
REQ = re.compile(r"\bREQ-\d{3,}\b")
ADR = re.compile(r"\bADR-\d{3,}\b")


def main() -> int:
    kp = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent
    if not kp.is_dir():
        print(f"knowledge plane not found: {kp}")
        return 1

    docs = sorted(kp.rglob("*.md"))
    reqs_file = kp / "product" / "requirements.md"
    defined_reqs = set(re.findall(r"^## (REQ-\d{3,})", reqs_file.read_text(), re.M)) if reqs_file.exists() else set()
    defined_adrs = {m.group(0) for p in (kp / "adr").glob("ADR-*.md") for m in [ADR.match(p.name)] if m}

    problems = []
    for doc in docs:
        if doc.name == "_template.md":
            continue
        text = doc.read_text(errors="ignore")
        rel = doc.relative_to(kp)
        for target in LINK.findall(text):
            if target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            path = target.split("#", 1)[0]
            if path and not (doc.parent / path).exists():
                problems.append(f"{rel}: broken link -> {target}")
        for rid in sorted(set(REQ.findall(text)) - defined_reqs):
            problems.append(f"{rel}: unknown requirement {rid}")
        for aid in sorted(set(ADR.findall(text)) - defined_adrs):
            problems.append(f"{rel}: unknown decision {aid}")

    for line in problems:
        print(line)
    print(f"kp-check: {len(docs)} files, {len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
