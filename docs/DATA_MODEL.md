# Data model

A topic is one YAML file in `content/topics/`, named `<id>.yml`. The authoritative definition is [`schema/topic.schema.json`](../schema/topic.schema.json); this document explains intent.

## Required fields

| Field | Notes |
|---|---|
| `id` | Lowercase hyphenated slug. Must match the filename stem. **Never reuse or repurpose an id** — links depend on it. |
| `label` | The name the field actually uses. |
| `domain`, `category` | Must exist in `content/taxonomy.yml`. |
| `definition` | What the concept means. Definitional, not argumentative. 40 characters minimum. |
| `maturity` | `emerging` · `active` · `established` · `historical`. |
| `cac_alignment` | See below. |
| `references` | At least one. All public HTTPS. |
| `created`, `updated` | ISO dates. `updated` must not precede `created`. |

## Optional fields

| Field | Notes |
|---|---|
| `aliases` | Other names in circulation. Fed into search, so people find the concept under whatever name they know it by. Worth filling in. |
| `why_it_matters` | The argument. |
| `current_understanding` | State of play. Distinguish established from contested. |
| `open_questions` | Questions the field has not settled. If someone could pick it up and do it, it is a thread instead. |
| `intervention_point` | Where in the pipeline work here applies pressure. |
| `affordance_class` | Which class of platform capability the topic concerns. |
| `lifecycle_stage` | Which stage of the exploitation backbone it touches. |
| `threads` | Work someone can pick up. |
| `related_topics` | Other topic ids. Edges render both ways automatically — declaring it on one side is enough. |
| `maintainers` | GitHub handles. |

## `cac_alignment`

```yaml
cac_alignment:
  status: partial
  classes:
    - https://cacontology.projectvic.org/detection#ContentHashingTool
  notes: >-
    What is covered, what is missing, and what an extension would need to add.
```

- Every IRI is checked against `content/cac-index.json`. An unknown IRI fails the build.
- `aligned` and `partial` require at least one class.
- `gap` must have no classes — if some exist, the status is `partial`.
- `partial`, `gap`, and `proposed` all require `notes`.
- `proposed` should carry `proposal_url` pointing at the upstream issue or PR.

## Threads

```yaml
threads:
  - id: coverage-estimate
    title: "Estimate the share of cases where hash matching was the first detection event"
    detail: >-
      What the work actually is.
    kind: dataset          # build | research | policy | dataset | evaluation | ontology | threat-intel
    effort: medium         # exploratory | small | medium | large | program
    status: open           # open | claimed | in_progress | needs_review | done | archived
    skills: [data-engineering, statistics]
    done_when:
      - Criteria a third party could check
    claimed_by: "@handle"
    tracking_url: https://github.com/...
    outcome: "What happened."
```

`done_when` is the field that separates a thread from a wish. Write criteria someone other than you could evaluate.

`id` must be unique within the topic. Thread ids are referenced in claim issues, so treat them as stable.

## References

```yaml
references:
  - title: "Bugs in our Pockets: The Risks of Client-Side Scanning"
    url: https://arxiv.org/abs/2110.07450
    type: paper
    publisher: "arXiv"
    date: "2021"
    note: "Why this source is here."
```

`type` must be one of the values in `reference_types` in the taxonomy. `date` accepts `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`.

Prefer a primary source over reporting about it. Use `note` to say what the reference supports when that is not obvious from the title.

## Generated fields

`build.py` adds these to `site/data/topics.json`. Do not put them in source files:

`thread_counts` · `domain_label` · `category_label` · `cac_alignment.resolved` · `_source` — and it rewrites `related_topics` to include inbound edges.
