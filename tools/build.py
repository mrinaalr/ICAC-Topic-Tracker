#!/usr/bin/env python3
"""Compile content/ into the JSON payloads the static site reads.

The site is plain HTML, CSS, and JavaScript with no runtime dependencies and no
server. Everything dynamic about it comes from the files this script writes into
site/data/. That directory is generated and gitignored — never edit it by hand.

Outputs
-------
    site/data/manifest.json     build metadata, counts, and integrity digest
    site/data/taxonomy.json     domains, categories, facets, reference types
    site/data/topics.json       every topic, fully denormalised for the client
    site/data/index.json        lightweight search index (id, label, aliases, text)
    site/data/cac.json          CAC module summaries + per-module class lists
    site/data/gaps.json         topics where CAC coverage is missing or partial

Usage
-----
    python3 tools/build.py                 # validate, then build
    python3 tools/build.py --skip-validate  # build only (CI validates separately)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.exit("PyYAML is required. Run: pip install -r requirements.txt")

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
TOPICS_DIR = CONTENT / "topics"
OUT = ROOT / "site" / "data"

# Thread statuses that count as "someone could pick this up right now".
ACTIONABLE = {"open", "claimed", "in_progress", "needs_review"}
OPEN_STATUSES = {"open"}


def load_yaml(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def write_json(path: Path, payload: object) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=False)
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


def git_rev() -> str | None:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, stderr=subprocess.DEVNULL
        ).decode().strip()
    except Exception:
        return None


def build() -> int:
    taxonomy = load_yaml(CONTENT / "taxonomy.yml")
    cac_index = json.loads((CONTENT / "cac-index.json").read_text(encoding="utf-8"))

    cac_by_iri = {c["iri"]: c for c in cac_index["classes"]}
    classes_by_module: dict[str, list] = defaultdict(list)
    for c in cac_index["classes"]:
        classes_by_module[c["module"]].append(c)

    topic_files = sorted(TOPICS_DIR.glob("*.yml"))
    topics: list[dict] = []
    for f in topic_files:
        data = load_yaml(f)
        data["_source"] = f.relative_to(ROOT).as_posix()
        topics.append(data)

    topics.sort(key=lambda t: (t["domain"], t["category"], t["label"].lower()))
    by_id = {t["id"]: t for t in topics}

    # --- denormalise -------------------------------------------------------
    # The client should never have to join. Resolve labels, expand CAC classes,
    # compute counts, and make relationships bidirectional here instead.

    domain_labels = {d["id"]: d["label"] for d in taxonomy["domains"]}
    category_labels: dict[tuple[str, str], str] = {}
    for d in taxonomy["domains"]:
        for c in d["categories"]:
            category_labels[(d["id"], c["id"])] = c["label"]

    backlinks: dict[str, set[str]] = defaultdict(set)
    for t in topics:
        for other in t.get("related_topics", []):
            if other in by_id:
                backlinks[other].add(t["id"])
                backlinks[t["id"]].add(other)

    for t in topics:
        threads = t.get("threads", []) or []
        t["thread_counts"] = {
            "total": len(threads),
            "open": sum(1 for x in threads if x["status"] in OPEN_STATUSES),
            "actionable": sum(1 for x in threads if x["status"] in ACTIONABLE),
            "done": sum(1 for x in threads if x["status"] == "done"),
        }
        t["domain_label"] = domain_labels.get(t["domain"], t["domain"])
        t["category_label"] = category_labels.get((t["domain"], t["category"]), t["category"])
        t["related_topics"] = sorted(backlinks.get(t["id"], set()))

        resolved = []
        for iri in t["cac_alignment"].get("classes", []) or []:
            entry = cac_by_iri.get(iri)
            resolved.append({
                "iri": iri,
                "module": entry["module"] if entry else "unknown",
                "local": entry["local"] if entry else iri.split("#")[-1],
                "label": entry["label"] if entry else iri.split("#")[-1],
                "comment": entry["comment"] if entry else "",
                "known": entry is not None,
            })
        t["cac_alignment"]["resolved"] = resolved

    # --- taxonomy payload, with live counts attached -----------------------
    topics_per_category = Counter((t["domain"], t["category"]) for t in topics)
    threads_per_category: Counter = Counter()
    for t in topics:
        threads_per_category[(t["domain"], t["category"])] += t["thread_counts"]["actionable"]

    tax_out = {
        "version": taxonomy.get("version", 1),
        "updated": str(taxonomy.get("updated", "")),
        "facets": taxonomy.get("facets", {}),
        "thread_facets": taxonomy.get("thread_facets", {}),
        "reference_types": taxonomy.get("reference_types", []),
        "domains": [],
    }
    for d in taxonomy["domains"]:
        cats = []
        for c in d["categories"]:
            key = (d["id"], c["id"])
            cats.append({
                **c,
                "topic_count": topics_per_category.get(key, 0),
                "actionable_threads": threads_per_category.get(key, 0),
            })
        tax_out["domains"].append({
            **{k: v for k, v in d.items() if k != "categories"},
            "categories": cats,
            "topic_count": sum(c["topic_count"] for c in cats),
            "actionable_threads": sum(c["actionable_threads"] for c in cats),
        })

    # --- CAC payload -------------------------------------------------------
    covered_iris = {
        iri
        for t in topics
        for iri in (t["cac_alignment"].get("classes") or [])
    }
    cac_out = {
        "_meta": cac_index["_meta"],
        "modules": [
            {
                **m,
                "classes": [
                    {"local": c["local"], "iri": c["iri"], "label": c["label"], "comment": c["comment"]}
                    for c in classes_by_module.get(m["id"], [])
                ],
                "referenced_class_count": sum(
                    1 for c in classes_by_module.get(m["id"], []) if c["iri"] in covered_iris
                ),
            }
            for m in cac_index["modules"]
        ],
    }

    # --- gaps payload ------------------------------------------------------
    # The reason the tracker exists: concepts the domain discusses that the
    # ontology does not yet model. This is a contribution queue for upstream.
    gaps = [
        {
            "id": t["id"],
            "label": t["label"],
            "domain": t["domain"],
            "domain_label": t["domain_label"],
            "category": t["category"],
            "category_label": t["category_label"],
            "status": t["cac_alignment"]["status"],
            "notes": t["cac_alignment"].get("notes", ""),
            "proposal_url": t["cac_alignment"].get("proposal_url"),
            "maturity": t["maturity"],
        }
        for t in topics
        if t["cac_alignment"]["status"] in {"gap", "partial", "proposed"}
    ]

    # --- search index ------------------------------------------------------
    index = [
        {
            "id": t["id"],
            "l": t["label"],
            "a": t.get("aliases", []),
            "d": t["domain"],
            "c": t["category"],
            "s": t["cac_alignment"]["status"],
            "m": t["maturity"],
            "n": t["thread_counts"]["actionable"],
            # Everything a free-text query should be able to hit, lowercased once
            # here so the client never has to.
            "t": " ".join(filter(None, [
                t["label"],
                " ".join(t.get("aliases", [])),
                t["definition"],
                t.get("why_it_matters", ""),
                " ".join(x["title"] for x in t.get("threads", []) or []),
                " ".join(c["label"] for c in t["cac_alignment"]["resolved"]),
            ])).lower(),
        }
        for t in topics
    ]

    # --- write -------------------------------------------------------------
    OUT.mkdir(parents=True, exist_ok=True)
    sizes = {
        "taxonomy.json": write_json(OUT / "taxonomy.json", tax_out),
        "topics.json": write_json(OUT / "topics.json", topics),
        "index.json": write_json(OUT / "index.json", index),
        "cac.json": write_json(OUT / "cac.json", cac_out),
        "gaps.json": write_json(OUT / "gaps.json", gaps),
    }

    digest = hashlib.sha256()
    for name in sorted(sizes):
        digest.update((OUT / name).read_bytes())

    status_counts = Counter(t["cac_alignment"]["status"] for t in topics)
    thread_status_counts: Counter = Counter()
    for t in topics:
        for x in t.get("threads", []) or []:
            thread_status_counts[x["status"]] += 1

    manifest = {
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "git_rev": git_rev(),
        "counts": {
            "topics": len(topics),
            "threads": sum(t["thread_counts"]["total"] for t in topics),
            "actionable_threads": sum(t["thread_counts"]["actionable"] for t in topics),
            "domains": len(taxonomy["domains"]),
            "categories": sum(len(d["categories"]) for d in taxonomy["domains"]),
            "cac_modules": len(cac_index["modules"]),
            "cac_classes": len(cac_index["classes"]),
            "cac_classes_referenced": len(covered_iris),
            "references": sum(len(t.get("references", [])) for t in topics),
        },
        "cac_status": dict(status_counts),
        "thread_status": dict(thread_status_counts),
        "digest": digest.hexdigest()[:16],
        "cac_source": cac_index["_meta"]["source"],
    }
    sizes["manifest.json"] = write_json(OUT / "manifest.json", manifest)

    print("Built site/data/")
    for name in sorted(sizes):
        print(f"  {name:<16} {sizes[name] / 1024:8.1f} KB")
    print()
    print(f"  topics              {manifest['counts']['topics']}")
    print(f"  threads             {manifest['counts']['threads']} "
          f"({manifest['counts']['actionable_threads']} actionable)")
    print(f"  CAC classes cited   {manifest['counts']['cac_classes_referenced']} "
          f"of {manifest['counts']['cac_classes']}")
    print(f"  CAC alignment       {dict(status_counts)}")
    print(f"  digest              {manifest['digest']}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--skip-validate", action="store_true", help="skip the validation pass")
    args = ap.parse_args()

    if not args.skip_validate:
        rc = subprocess.call([sys.executable, str(ROOT / "tools" / "validate.py"), "--quiet"])
        if rc != 0:
            print("\nValidation failed — refusing to build. Fix the errors above.", file=sys.stderr)
            return rc
        print()

    return build()


if __name__ == "__main__":
    raise SystemExit(main())
