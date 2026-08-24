# ICAC Topic Tracker

**Created to track issues, topics, and challenges in the issue space for engineers, researchers, and other professionals to cleanly see the issues and design interdictions.**

Internet Crimes Against Children is a large domain of discourse spread across enforcement, platform trust and safety, law, clinical practice, and research. The problems in it are well known to the people working on any one part and largely invisible to everyone else. This is a browsable, citable map of those problems — organised so that someone with the right skills can find a piece of work that matches them and start on it.

Live site: **https://mrinaalr.github.io/ICAC-Topic-Tracker/**

---

## What is in it

Each entry is a **topic** — a concept the field actually discusses, not a heading someone invented. A topic carries:

| Part | What it is |
|---|---|
| **Definition** | What the concept means in this domain. Definitional, not argumentative. |
| **Why it matters** | The case for tracking it. |
| **Current understanding** | State of play — what is known, what is contested, what changed. |
| **Open questions** | What the field has not settled. |
| **CAC alignment** | The ontology classes that formally model the concept. |
| **Threads** | Concrete work someone can pick up, each with criteria for what counts as done. |
| **References** | Public sources, every one openable without credentials. |

Topics are filed under four domains — **Exploitation Vectors**, **Technology**, **Policy & Law Enforcement**, and **Research & Data** — and drilled into by category. The navigation is designed so you do not have to explore: if you already know AI is your area, you press Technology, then Generative AI, and you are looking at the work.

## Grounded in the CAC Ontology

Topics are anchored to the [Crimes Against Children Ontology](https://github.com/Project-VIC-International/CAC-Ontology), shepherded by Project VIC International and built on the Cyber Domain Ontology stack ([UCO](https://unifiedcyberontology.org/) and [CASE](https://caseontology.org/)).

That means a concept here maps to a formally defined class with a stable IRI rather than to ad-hoc terminology, and the mapping is machine-checked: a flattened index of the ontology is vendored at [`content/cac-index.json`](content/cac-index.json), and CI rejects any topic that declares a class the ontology does not define. Where a topic is only partly modelled, it says so and says what is missing — which turns this into a queue of possible contributions back upstream.

## Scope

> **Public sources only.** Every reference must be a publicly reachable URL that anyone can open without credentials.

This is **not** a tip line, a case-management system, an investigation tool, or a place for law enforcement data, victim or offender identification, or material from restricted systems. Contributions requiring any of those are out of scope. Full policy in [SCOPE.md](SCOPE.md).

---

## Quick start

```bash
git clone https://github.com/mrinaalr/ICAC-Topic-Tracker.git
cd ICAC-Topic-Tracker
pip install -r requirements.txt

python3 tools/build.py                      # validate content, generate site/data/
python3 -m http.server -d site 8000         # then open http://localhost:8000
```

### Add a topic

```bash
# 1. find the CAC classes that model your concept
python3 tools/new_topic.py --search "on-device detection"

# 2. scaffold the file
python3 tools/new_topic.py \
  --id on-device-csam-blocking \
  --label "On-Device CSAM File-Blocking" \
  --domain technology --category on-device

# 3. fill in the TODOs, then check your work
python3 tools/validate.py content/topics/on-device-csam-blocking.yml
python3 tools/build.py
```

Open a pull request. CI runs the same validation and blocks the merge if anything fails.

---

## How it works

```
content/topics/*.yml   ──┐
content/taxonomy.yml   ──┼──▶  tools/build.py  ──▶  site/data/*.json  ──▶  site/  (GitHub Pages)
content/cac-index.json ──┘          │
                                    └── tools/validate.py  (schema + taxonomy + ontology + scope)
```

Content is plain YAML under version control, so every change to the map of the field is a reviewable diff with an author and a date. The site is static HTML, CSS, and vanilla JavaScript with no framework, no build toolchain, and no runtime dependencies — it is deployed by copying files.

| Path | Purpose |
|---|---|
| `content/topics/` | One YAML file per topic. The actual content. |
| `content/taxonomy.yml` | Domains, categories, facets. Single source of truth for structure. |
| `content/cac-index.json` | Vendored CAC ontology index. Generated; do not hand-edit. |
| `schema/topic.schema.json` | JSON Schema for a topic file. |
| `tools/validate.py` | Schema, taxonomy, ontology, and scope checks. Runs in CI. |
| `tools/build.py` | Compiles content into `site/data/`. |
| `tools/new_topic.py` | Scaffolder and CAC class search. |
| `tools/sync_cac_index.py` | Regenerates the ontology index from upstream. |
| `site/` | The static site. `site/data/` is generated and gitignored. |

Deeper notes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md), [`docs/TAXONOMY.md`](docs/TAXONOMY.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SCOPE.md](SCOPE.md). In short: topics are pull requests, threads are claimed by opening an issue, and every factual claim needs a public source.

## Sources and prior work

The analytical vocabulary — affordance classes, exploitation lifecycle stages, intervention points — is drawn from published work and cited on the topics that use it:

- **CAC Ontology** — Project VIC International. <https://github.com/Project-VIC-International/CAC-Ontology> (Apache-2.0)
- **CASE** and **UCO** — the Cyber Domain Ontology standards CAC extends. <https://caseontology.org/> · <https://unifiedcyberontology.org/>
- Ramachandran, M. *Affordances for Harm: How Offenders Misuse Platform Capabilities to Exploit Children, and Where to Intervene.* Zenodo, 2026. <https://doi.org/10.5281/zenodo.21347781>
- Ramachandran, M. *CaseLinker: An Open-Source System for Cross-Case Analysis of Internet Crimes Against Children Reports.* <https://doi.org/10.5281/zenodo.18744216> · <https://github.com/mrinaalr/CaseLinker>
- **End Child Exploitation** — background research notes. <https://end-child-exploitation.com/>

## Licence

Code is MIT. Topic content under `content/` is additionally released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), so it can be reused and cited freely with attribution. The vendored CAC ontology index derives from the CAC Ontology, which is Apache-2.0.
