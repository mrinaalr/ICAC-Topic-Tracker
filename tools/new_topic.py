#!/usr/bin/env python3
"""Scaffold a new topic file, and help find the CAC classes to anchor it to.

Two modes, both interactive-free so they compose in scripts:

    # search the vendored CAC index for candidate classes
    python3 tools/new_topic.py --search "sextortion coercion"

    # scaffold a topic file
    python3 tools/new_topic.py --id on-device-csam-blocking \
        --label "On-Device CSAM File-Blocking" \
        --domain technology --category on-device

The scaffold is deliberately filled with TODO markers rather than plausible
placeholder prose. A topic that reads as finished but says nothing is worse than
an obviously unfinished one, and validate.py will reject the TODOs anyway.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.exit("PyYAML is required. Run: pip install -r requirements.txt")

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
TOPICS_DIR = CONTENT / "topics"

TEMPLATE = """\
# {label}
#
# Fill in every TODO. tools/validate.py will reject this file until you do.
# Guidance: docs/DATA_MODEL.md — Field-by-field notes
# CAC classes: python3 tools/new_topic.py --search "<term>"

id: {id}
label: "{label}"
aliases: []

domain: {domain}
category: {category}

# What this concept means in this domain. Definitional, not argumentative.
# 40 characters minimum; aim for two or three sentences.
definition: >-
  TODO

# Why the concept is worth tracking. This is where an argument belongs.
why_it_matters: >-
  TODO

# The state of play. What is known, what is contested, what changed recently.
current_understanding: >-
  TODO

open_questions:
  - TODO

maturity: {maturity}          # emerging | active | established | historical

intervention_point: []        # see content/taxonomy.yml -> facets
affordance_class: []
lifecycle_stage: []

cac_alignment:
  # aligned | partial | gap | proposed | out_of_scope
  status: {cac_status}
  classes: []
  # Required for partial, gap, and proposed: what is covered, what is missing,
  # and what an extension would need to add.
  notes: >-
    TODO

threads:
  - id: TODO-slug
    title: TODO
    detail: >-
      TODO
    kind: research            # build | research | policy | dataset | evaluation | ontology | threat-intel
    effort: exploratory       # exploratory | small | medium | large | program
    status: open
    skills: []
    done_when:
      - TODO

references:
  - title: TODO
    url: https://TODO
    type: paper               # see content/taxonomy.yml -> reference_types
    publisher: TODO
    date: "{year}"

related_topics: []

created: "{today}"
updated: "{today}"
maintainers: []
"""


def load_taxonomy() -> dict:
    with (CONTENT / "taxonomy.yml").open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def search(terms: str, limit: int) -> int:
    index = json.loads((CONTENT / "cac-index.json").read_text(encoding="utf-8"))
    words = [w.lower() for w in re.split(r"\s+", terms.strip()) if w]
    if not words:
        sys.exit("--search needs at least one term")

    scored = []
    for c in index["classes"]:
        hay = f"{c['local']} {c['label']} {c['comment']}".lower()
        score = 0
        for w in words:
            if w in c["local"].lower():
                score += 6
            elif w in c["label"].lower():
                score += 4
            elif w in c["comment"].lower():
                score += 1
        if score:
            scored.append((score, c))

    scored.sort(key=lambda x: (-x[0], x[1]["module"], x[1]["local"]))
    if not scored:
        print(f"No CAC classes matched {terms!r}.")
        print("If the domain genuinely discusses this concept and CAC has no class")
        print("for it, that is an ontology gap — set cac_alignment.status: gap and")
        print("say what a class would need to capture.")
        return 0

    print(f"{len(scored)} match(es) for {terms!r} — showing {min(limit, len(scored))}\n")
    for score, c in scored[:limit]:
        print(f"  {c['label']}  [{c['module']}]  (score {score})")
        print(f"    {c['iri']}")
        if c["comment"]:
            comment = c["comment"]
            print(f"    {comment[:150]}{'...' if len(comment) > 150 else ''}")
        print()
    return 0


def scaffold(args: argparse.Namespace) -> int:
    tax = load_taxonomy()
    domains = {d["id"]: {c["id"] for c in d["categories"]} for d in tax["domains"]}

    if args.domain not in domains:
        sys.exit(f"Unknown domain {args.domain!r}. Choose one of: {', '.join(sorted(domains))}")
    if args.category not in domains[args.domain]:
        sys.exit(
            f"Unknown category {args.category!r} for domain {args.domain!r}.\n"
            f"Choose one of: {', '.join(sorted(domains[args.domain]))}"
        )
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", args.id):
        sys.exit(f"id {args.id!r} must be a lowercase hyphenated slug")

    out = TOPICS_DIR / f"{args.id}.yml"
    if out.exists() and not args.force:
        sys.exit(f"{out.relative_to(ROOT)} already exists. Pass --force to overwrite.")

    today = date.today()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        TEMPLATE.format(
            id=args.id,
            label=args.label,
            domain=args.domain,
            category=args.category,
            maturity=args.maturity,
            cac_status=args.cac_status,
            today=today.isoformat(),
            year=today.year,
        ),
        encoding="utf-8",
    )

    print(f"Created {out.relative_to(ROOT)}\n")
    print("Next:")
    print(f"  1. Fill in the TODOs")
    print(f"  2. python3 tools/new_topic.py --search \"{args.label.lower()}\"   # find CAC classes")
    print(f"  3. python3 tools/validate.py {out.relative_to(ROOT)}")
    print(f"  4. python3 tools/build.py && python3 -m http.server -d site 8000")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--search", metavar="TERMS", help="search the CAC index for candidate classes")
    ap.add_argument("--limit", type=int, default=12, help="max search results (default 12)")

    ap.add_argument("--id", help="topic slug, also the filename stem")
    ap.add_argument("--label", help="human-readable topic name")
    ap.add_argument("--domain", help="taxonomy domain id")
    ap.add_argument("--category", help="taxonomy category id")
    ap.add_argument("--maturity", default="active", help="emerging | active | established | historical")
    ap.add_argument("--cac-status", default="gap", dest="cac_status",
                    help="aligned | partial | gap | proposed | out_of_scope")
    ap.add_argument("--force", action="store_true", help="overwrite an existing file")
    args = ap.parse_args()

    if args.search:
        return search(args.search, args.limit)

    missing = [f"--{f}" for f in ("id", "label", "domain", "category") if not getattr(args, f)]
    if missing:
        ap.print_help()
        sys.exit(f"\nMissing required argument(s): {', '.join(missing)}")

    return scaffold(args)


if __name__ == "__main__":
    raise SystemExit(main())
