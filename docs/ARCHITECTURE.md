# Architecture

## Shape

```
content/topics/*.yml   ──┐
content/taxonomy.yml   ──┼──▶  tools/build.py  ──▶  site/data/*.json  ──▶  site/
content/cac-index.json ──┤          │                                       (GitHub Pages)
content/future-work.yml─┘          └── tools/validate.py
```

Content is YAML in git. A build step compiles it to JSON. A static site reads the JSON. There is no server, no database, and no runtime dependency.

## Why it is built this way

**Content in git, not a database.** Every change to the map of the field is a diff with an author, a date, and a review. That is the right audit trail for a reference work, and it means the whole thing survives the site going away — the YAML is readable on its own.

**A build step, rather than parsing YAML in the browser.** The build does the joins once: resolving category labels, expanding CAC class IRIs into labels and definitions, computing counts, making `related_topics` bidirectional. The client never joins, so it stays simple and fast.

**Validation separate from build.** `validate.py` runs standalone in CI on every pull request. `build.py` calls it first and refuses to build on error, so a broken topic cannot reach the site through either path.

**Vanilla JavaScript.** A framework would add a toolchain, a lockfile, and a supply chain to a site that renders lists and paragraphs. The whole client is one file with no dependencies, which is also what makes it approachable to a contributor who is a criminologist rather than a frontend developer.

## Data flow in detail

1. **`validate.py`** checks each topic against the JSON Schema, then against `taxonomy.yml` (domain, category, facet values), then against `cac-index.json` (every declared class IRI must exist), then referentially (`related_topics` resolve), then against the scope policy (URLs are public HTTPS), then hygiene (unique thread ids, ordered dates, outcomes on finished threads).

2. **`build.py`** loads the same inputs plus `content/future-work.yml` and writes seven files:

   | File | Contents | Loaded |
   |---|---|---|
   | `manifest.json` | Build metadata, counts, digest | On boot |
   | `taxonomy.json` | Structure with live topic and thread counts attached | On boot |
   | `topics.json` | Every topic, fully denormalised | On boot |
   | `index.json` | Compact search index | On boot |
    | `cac.json` | Ontology modules and classes | Lazily, only for the ontology view |
    | `future-work.json` | Horizon brief: structural shifts and research priorities filed onto topics | On boot |
    | `gaps.json` | Topics with incomplete CAC coverage | On demand |

   `cac.json` is the large one, so it is fetched only when someone opens the ontology page rather than on every visit.

3. **`app.js`** fetches the four boot payloads in parallel, then renders by hash route. Every view is deep-linkable.

## The ontology index

Topics anchor to CAC classes by IRI. Validating those IRIs needs the ontology, but requiring every contributor to clone a second repository would be a real barrier for the non-engineers this project wants contributions from.

So `tools/sync_cac_index.py` flattens the upstream Turtle into one JSON file, which is committed. It parses `owl:Class` declarations for classes in CAC's own namespace, skipping SHACL shapes files (which constrain classes rather than define them) and imported UCO/CASE/gUFO terms.

The index is regenerated deliberately, never automatically, so an upstream change that removes a class someone cites shows up as a reviewed diff and a validation failure rather than as a silently broken page.

## Deployment

`.github/workflows/pages.yml` installs dependencies, runs the build, and publishes `site/` to GitHub Pages on every push to `main`. Because `site/data/` is generated and gitignored, the deployed site is always built from the content at that commit — there is no way for stale JSON to be served.

## Extension points

Ordered roughly by ratio of value to effort:

- **A thread status board** — threads grouped by status across all topics, so activity is visible at a glance.
- **A topic graph** — `related_topics` is already bidirectional and would render directly as a force graph.
- **Ontology coverage drill-down** — clicking a module to see which classes are cited and by which topics.
- **Link checking** — a scheduled workflow that verifies references still resolve and opens an issue when one rots.
- **Per-topic feeds** — Atom feeds so people can watch an area rather than the whole repository.
- **Cross-referencing CaseLinker** — topics could link to evidence cohorts in the public corpus, given a stable query URL.

None of these require changing the data model.
