#!/usr/bin/env python3
"""Validate every topic file against the schema, the taxonomy, the CAC index,
and the scope policy.

This runs in CI on every pull request. It is intentionally strict: the value of
the tracker depends on the data staying clean, and a permissive validator only
moves the cost to whoever reads the site later.

Checks performed
----------------
  1. Structural   — each topic validates against schema/topic.schema.json
  2. Identity     — id matches filename stem; ids are globally unique
  3. Taxonomy     — domain, category, and every facet value exist in taxonomy.yml
  4. CAC          — every declared class IRI exists in content/cac-index.json,
                    and cac_alignment.status is consistent with what is declared
  5. Referential  — related_topics point at topics that exist
  6. Scope        — every reference URL passes the public-source policy
  7. Hygiene      — thread ids unique within a topic, dates well-ordered,
                    finished threads record an outcome

Usage
-----
    python3 tools/validate.py            # validate everything
    python3 tools/validate.py --quiet    # errors only
    python3 tools/validate.py path.yml   # validate specific files
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.exit("PyYAML is required. Run: pip install -r requirements.txt")

try:
    from jsonschema import Draft202012Validator, FormatChecker
except ImportError:  # pragma: no cover
    sys.exit("jsonschema is required. Run: pip install -r requirements.txt")


ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
TOPICS_DIR = CONTENT / "topics"
TAXONOMY_PATH = CONTENT / "taxonomy.yml"
CAC_INDEX_PATH = CONTENT / "cac-index.json"
SCHEMA_PATH = ROOT / "schema" / "topic.schema.json"

# --- Scope policy ----------------------------------------------------------
# A reference must be reachable by anyone with a browser and no credentials.
# These are the mechanical checks; the judgement calls live in SCOPE.md and in
# review. See docs/SCOPE_ENFORCEMENT.md for why this list is short on purpose.

BLOCKED_HOST_SUFFIXES = (
    ".onion",
    ".local",
    "localhost",
)

BLOCKED_HOST_EXACT = {
    "127.0.0.1",
    "0.0.0.0",
    "::1",
}

# Hosts that exist but sit behind authentication, a paywall keyed to law
# enforcement access, or a restricted-distribution agreement. Linking these
# defeats the point: a reader cannot verify the claim.
RESTRICTED_HOSTS = {
    "pacer.login.uscourts.gov": "PACER requires an account; link the free-look or a published copy instead",
    "ecf.uscourts.gov": "CM/ECF requires an account; link a published copy instead",
    "law-enforcement.ncmec.org": "law-enforcement portal; not publicly reachable",
    "cjis.gov": "restricted law enforcement system",
    "leo.gov": "restricted law enforcement system",
    "ncptc.leo.gov": "restricted law enforcement system",
}

PRIVATE_IP_RE = re.compile(r"^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)")


class Problem:
    __slots__ = ("path", "level", "message")

    def __init__(self, path: str, level: str, message: str) -> None:
        self.path, self.level, self.message = path, level, message

    def __str__(self) -> str:
        mark = "ERROR" if self.level == "error" else "warn "
        return f"  [{mark}] {self.path}: {self.message}"


def load_yaml(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if not isinstance(data, dict):
        raise ValueError("file must contain a single YAML mapping")
    return data


def build_taxonomy_index(tax: dict) -> dict:
    """Flatten taxonomy.yml into lookup sets the validator can check against."""
    categories: dict[str, set[str]] = {}
    cac_modules_by_cat: dict[tuple[str, str], list[str]] = {}
    for domain in tax.get("domains", []):
        cats = {c["id"] for c in domain.get("categories", [])}
        categories[domain["id"]] = cats
        for c in domain.get("categories", []):
            cac_modules_by_cat[(domain["id"], c["id"])] = c.get("cac_modules", [])

    def facet_values(block: dict, name: str) -> set[str]:
        facet = block.get(name, {})
        return {v["id"] for v in facet.get("values", [])}

    facets = tax.get("facets", {})
    threads = tax.get("thread_facets", {})
    return {
        "categories": categories,
        "cac_modules_by_cat": cac_modules_by_cat,
        "maturity": facet_values(facets, "maturity"),
        "cac_status": facet_values(facets, "cac_status"),
        "intervention_point": facet_values(facets, "intervention_point"),
        "affordance_class": facet_values(facets, "affordance_class"),
        "lifecycle_stage": facet_values(facets, "lifecycle_stage"),
        "thread_kind": facet_values(threads, "kind"),
        "thread_effort": facet_values(threads, "effort"),
        "thread_status": facet_values(threads, "status"),
        "thread_skills": facet_values(threads, "skills"),
        "thread_skills_open": threads.get("skills", {}).get("open", False),
        "reference_types": {r["id"] for r in tax.get("reference_types", [])},
    }


def check_url(url: str, where: str, out: list[Problem]) -> None:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()

    if parsed.scheme != "https":
        out.append(Problem(where, "error", f"reference must use https: {url}"))
        return
    if not host:
        out.append(Problem(where, "error", f"reference has no host: {url}"))
        return
    if host in BLOCKED_HOST_EXACT or PRIVATE_IP_RE.match(host):
        out.append(Problem(where, "error", f"reference points at a private address: {url}"))
        return
    for suffix in BLOCKED_HOST_SUFFIXES:
        if host == suffix.lstrip(".") or host.endswith(suffix):
            out.append(Problem(where, "error", f"reference host is not publicly reachable ({host}): {url}"))
            return
    if host in RESTRICTED_HOSTS:
        out.append(Problem(where, "error", f"{RESTRICTED_HOSTS[host]} — {url}"))


def validate_topic(
    path: Path,
    data: dict,
    validator: Draft202012Validator,
    tax: dict,
    cac_classes: set[str],
    all_ids: set[str],
) -> list[Problem]:
    out: list[Problem] = []
    rel = path.relative_to(ROOT).as_posix()

    # 1. structural
    for err in sorted(validator.iter_errors(data), key=lambda e: list(e.path)):
        loc = "/".join(str(p) for p in err.path) or "(root)"
        out.append(Problem(rel, "error", f"{loc}: {err.message}"))
    if out:
        return out  # downstream checks assume a well-formed document

    topic_id = data["id"]

    # 2. identity
    if topic_id != path.stem:
        out.append(Problem(rel, "error", f"id '{topic_id}' does not match filename stem '{path.stem}'"))

    # 3. taxonomy
    domain, category = data["domain"], data["category"]
    if domain not in tax["categories"]:
        out.append(Problem(rel, "error", f"unknown domain '{domain}'"))
    elif category not in tax["categories"][domain]:
        out.append(Problem(rel, "error", f"unknown category '{category}' for domain '{domain}'"))

    if data["maturity"] not in tax["maturity"]:
        out.append(Problem(rel, "error", f"unknown maturity '{data['maturity']}'"))

    for facet in ("intervention_point", "affordance_class", "lifecycle_stage"):
        for value in data.get(facet, []):
            if value not in tax[facet]:
                out.append(Problem(rel, "error", f"unknown {facet} '{value}'"))

    for i, ref in enumerate(data.get("references", [])):
        if ref["type"] not in tax["reference_types"]:
            out.append(Problem(rel, "error", f"references[{i}]: unknown type '{ref['type']}'"))

    # 4. CAC alignment
    align = data["cac_alignment"]
    status = align["status"]
    classes = align.get("classes", [])
    if status not in tax["cac_status"]:
        out.append(Problem(rel, "error", f"unknown cac_alignment.status '{status}'"))

    for iri in classes:
        if iri not in cac_classes:
            out.append(Problem(
                rel, "error",
                f"cac_alignment references a class not in the CAC index: {iri} "
                f"(run tools/sync_cac_index.py if the ontology has moved on)"))

    if status in {"aligned", "partial"} and not classes:
        out.append(Problem(rel, "error", f"cac_alignment.status is '{status}' but no classes are listed"))
    if status == "gap" and classes:
        out.append(Problem(rel, "error", "cac_alignment.status is 'gap' but classes are listed — use 'partial'"))
    if status in {"gap", "partial", "proposed"} and not align.get("notes"):
        out.append(Problem(rel, "error", f"cac_alignment.status is '{status}' and requires notes explaining what is missing"))
    if status == "proposed" and not align.get("proposal_url"):
        out.append(Problem(rel, "warn", "cac_alignment.status is 'proposed' but no proposal_url is recorded"))

    # 5. referential
    for other in data.get("related_topics", []):
        if other == topic_id:
            out.append(Problem(rel, "error", "related_topics lists the topic itself"))
        elif other not in all_ids:
            out.append(Problem(rel, "error", f"related_topics points at unknown topic '{other}'"))

    # 6. scope
    for i, ref in enumerate(data.get("references", [])):
        check_url(ref["url"], f"{rel} references[{i}]", out)
    for t in data.get("threads", []):
        for i, ref in enumerate(t.get("references", [])):
            check_url(ref["url"], f"{rel} threads/{t['id']} references[{i}]", out)
        if t.get("tracking_url"):
            check_url(t["tracking_url"], f"{rel} threads/{t['id']} tracking_url", out)
    if align.get("proposal_url"):
        check_url(align["proposal_url"], f"{rel} cac_alignment.proposal_url", out)

    # 7. hygiene
    seen_threads: set[str] = set()
    for t in data.get("threads", []):
        tid = t["id"]
        if tid in seen_threads:
            out.append(Problem(rel, "error", f"duplicate thread id '{tid}'"))
        seen_threads.add(tid)

        if t["kind"] not in tax["thread_kind"]:
            out.append(Problem(rel, "error", f"thread '{tid}': unknown kind '{t['kind']}'"))
        if t["effort"] not in tax["thread_effort"]:
            out.append(Problem(rel, "error", f"thread '{tid}': unknown effort '{t['effort']}'"))
        if t["status"] not in tax["thread_status"]:
            out.append(Problem(rel, "error", f"thread '{tid}': unknown status '{t['status']}'"))
        if not tax["thread_skills_open"]:
            for s in t.get("skills", []):
                if s not in tax["thread_skills"]:
                    out.append(Problem(rel, "error", f"thread '{tid}': unknown skill '{s}'"))

        if t["status"] in {"claimed", "in_progress"} and not t.get("claimed_by"):
            out.append(Problem(rel, "warn", f"thread '{tid}' is '{t['status']}' but has no claimed_by"))
        if t["status"] in {"done", "archived"} and not t.get("outcome"):
            out.append(Problem(rel, "warn", f"thread '{tid}' is '{t['status']}' but records no outcome"))
        if t["status"] == "open" and not t.get("done_when"):
            out.append(Problem(rel, "warn", f"thread '{tid}' is open but has no done_when criteria"))

    created, updated = data["created"], data["updated"]
    if updated < created:
        out.append(Problem(rel, "error", f"updated ({updated}) is before created ({created})"))
    if updated > date.today().isoformat():
        out.append(Problem(rel, "warn", f"updated ({updated}) is in the future"))

    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="*", type=Path, help="specific topic files (default: all)")
    ap.add_argument("--quiet", action="store_true", help="suppress warnings")
    ap.add_argument("--strict", action="store_true", help="treat warnings as errors")
    args = ap.parse_args()

    taxonomy = build_taxonomy_index(load_yaml(TAXONOMY_PATH))
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema, format_checker=FormatChecker())

    cac = json.loads(CAC_INDEX_PATH.read_text(encoding="utf-8"))
    cac_classes = {c["iri"] for c in cac["classes"]}
    cac_modules = {m["id"] for m in cac["modules"]}

    files = args.paths or sorted(TOPICS_DIR.glob("*.yml"))
    if not files:
        print("No topic files found under content/topics/.")
        return 0

    # Pre-pass so related_topics can be checked against the full id set, and so
    # duplicate ids are caught even when only some files are being validated.
    all_ids: set[str] = set()
    id_sources: dict[str, list[str]] = {}
    for f in sorted(TOPICS_DIR.glob("*.yml")):
        try:
            d = load_yaml(f)
        except Exception:
            continue
        if isinstance(d, dict) and "id" in d:
            all_ids.add(d["id"])
            id_sources.setdefault(d["id"], []).append(f.name)

    problems: list[Problem] = []
    for tid, sources in id_sources.items():
        if len(sources) > 1:
            problems.append(Problem("content/topics", "error", f"id '{tid}' declared in multiple files: {', '.join(sources)}"))

    for f in files:
        try:
            data = load_yaml(f)
        except Exception as exc:
            problems.append(Problem(f.relative_to(ROOT).as_posix(), "error", f"could not parse: {exc}"))
            continue
        problems.extend(validate_topic(
            f, data, validator, taxonomy, cac_classes, all_ids))

    errors = [p for p in problems if p.level == "error"]
    warnings = [p for p in problems if p.level == "warn"]

    shown = errors if args.quiet else problems
    for p in shown:
        print(p, file=sys.stderr if p.level == "error" else sys.stdout)

    print(
        f"\n{len(files)} topic file(s) checked against {len(cac_classes)} CAC classes "
        f"across {len(cac_modules)} modules — {len(errors)} error(s), {len(warnings)} warning(s)."
    )

    if errors or (args.strict and warnings):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
