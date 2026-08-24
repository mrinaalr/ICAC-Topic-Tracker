# Taxonomy

`content/taxonomy.yml` is the single source of truth for how the tracker is organised. Add a category there and it appears in the UI; nothing else changes.

## Structure

**Five domains**, chosen so that someone arriving with a question knows immediately which box to press:

| Domain | Question it answers |
|---|---|
| Exploitation Vectors | How are children reached and harmed? |
| Technology | What capabilities are involved, on both sides? |
| Policy & Law Enforcement | What does the response system do, and what constrains it? |
| Research & Data | What can the field not currently measure? |
| Future Threats | How has the medium changed the offense, and what research is still missing? |

Future Threats is the horizon view. It is not a sixth filing cabinet for current offense types: a concept that is already a vector, a capability, or a response-system problem stays in those domains. What belongs here is a structural shift — scale of access, AI-enhanced offending, agent-facilitated and orchestrated offending, community formation — or a research priority that is not yet a settled topic.

The Future Threats *tab* is a map onto the rest of the tracker. Each research priority from the public brief is filed against a topic where one exists, or against a taxonomy slot that is still empty. That is how the tab stays queryable rather than becoming a second essay.

Each domain holds categories. Each category declares the CAC ontology modules that cover it, which is what makes the structure checkable rather than decorative.

The same real-world problem often appears in more than one domain — AI-generated CSAM is both a vector and a technology. Categories are filing locations, not claims about mutual exclusivity; cross-cutting facets and `related_topics` carry the connections.

## Facets

Facets apply to every topic regardless of category. They are what make the tracker queryable rather than merely browsable.

**`maturity`** — how settled the concept is: `emerging`, `active`, `established`, `historical`.

**`cac_status`** — whether the ontology models it: `aligned`, `partial`, `gap`, `proposed`, `out_of_scope`.

**`intervention_point`** — where work would apply pressure: platform prevention, detection and monitoring, reporting and intake, investigation and attribution, legal intervention, prosecution and disruption, victim safeguarding.

**`affordance_class`** — which class of platform capability is involved: contact and approach, production, possession and trade, coordination.

**`lifecycle_stage`** — which stage of the exploitation backbone: initial contact, conditioning, exploitation, maintenance.

## Where the vocabulary comes from

The affordance classes, lifecycle stages, and intervention points are not invented here. They are taken from published work on platform affordances and ICAC enforcement records, and cited on the topics that use them.

Borrowing rather than inventing is deliberate. Vocabulary that already appears in a paper and in an ontology can be argued with, checked, and — importantly — used to join data across projects. A private taxonomy could not.

The lifecycle stages correspond directly to CAC classes in the grooming module, and the affordance classes to classes in the platforms module as of CAC v3.1.0. That correspondence is what lets a topic's facets and its ontology alignment be checked against each other rather than drifting apart.

## Changing it

The taxonomy is meant to be stable. Someone who bookmarks a category should still find it there next year.

- **Adding a category** — open an issue first. If it would hold one topic, that topic probably belongs in an existing category.
- **Adding a domain** — a larger decision. Five top-level boxes is already close to the limit of what a landing page can present without becoming a menu to be explored, which is the failure mode this design exists to avoid.
- **Renaming** — changing a category `id` breaks every link to it. Change the `label` instead; ids are internal.
- **Adding facet values** — lower stakes, but check first whether an existing value covers it.
