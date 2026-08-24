# Contributing

Two ways to contribute: **add or improve a topic**, or **take a thread**.

Read [SCOPE.md](SCOPE.md) first. It is short, and it is the part most likely to get a pull request declined.

---

## Take a thread

Threads are the open work items on each topic — visible together at [Open work](https://mrinaalr.github.io/ICAC-Topic-Tracker/#/threads).

1. Find one that matches your skills and the time you have.
2. Open an issue using the **Claim a thread** template, naming the topic and thread id.
3. A maintainer sets `status: claimed` and `claimed_by` on the thread.
4. Work in the open where you can. When you are done, open a pull request updating the thread's `status` and `outcome`, and add a reference to what you produced.

You do not need permission to start. Claiming exists so two people do not silently duplicate each other.

---

## Add or improve a topic

A topic is one YAML file in `content/topics/`. Nothing else needs to change.

```bash
pip install -r requirements.txt

# 1. Find the CAC ontology classes that model your concept.
python3 tools/new_topic.py --search "age verification"

# 2. Scaffold.
python3 tools/new_topic.py \
  --id age-assurance \
  --label "Age Assurance" \
  --domain technology --category age-assurance

# 3. Fill in the TODOs.

# 4. Check.
python3 tools/validate.py content/topics/age-assurance.yml
python3 tools/build.py
python3 -m http.server -d site 8000
```

Then open a pull request. CI runs the same checks.

### What a good topic looks like

**Definition** is definitional. It says what the concept means, the way a glossary would. Arguments go in *why it matters*.

**Current understanding** distinguishes what is established from what is contested, and says which is which. If the evidence for something is thin, say that — an honest "the sample is small and this should be treated as a hypothesis" is worth more than a confident sentence that a reader has to go and check.

**Open questions** are questions, not tasks. If someone could pick it up and do it, it is a thread.

**Threads** have `done_when` criteria that a third party could check. "Research age verification" is not a thread. "Produce a jurisdiction-by-jurisdiction table with a primary source per row" is.

**References** are public, specific, and load-bearing. Prefer a primary source to reporting about it. Do not pad.

### CAC alignment

Set `cac_alignment.status` honestly:

| Status | When |
|---|---|
| `aligned` | CAC classes model the concept directly. List them. |
| `partial` | CAC models part of it. List what exists and say in `notes` what is missing. |
| `gap` | The domain discusses it, CAC has no class. `notes` should say what a class would need to capture. |
| `proposed` | An extension has been proposed upstream. Link it in `proposal_url`. |
| `out_of_scope` | A real concept, but outside what CAC is meant to model. |

Search before declaring a gap — the ontology is large, and the class is often there under a name you did not expect:

```bash
python3 tools/new_topic.py --search "your concept here"
```

A well-argued `gap` or `partial` is one of the more valuable contributions here: it is a concrete, evidenced suggestion for the [CAC Ontology](https://github.com/Project-VIC-International/CAC-Ontology) maintainers. Taking it upstream yourself is even better.

---

## Changing the taxonomy

Categories live in `content/taxonomy.yml`. Adding one makes it appear in the UI; nothing else changes.

Open an issue before adding a domain or category. The taxonomy is meant to be stable — a reader who bookmarks a category should still find it there next year. Adding a category to hold a single topic is usually a sign the topic belongs in an existing one.

## Updating the ontology index

When upstream publishes a new version:

```bash
git clone --depth 1 https://github.com/Project-VIC-International/CAC-Ontology /tmp/CAC-Ontology
python3 tools/sync_cac_index.py --ontology-dir /tmp/CAC-Ontology/ontology
python3 tools/validate.py    # catches topics citing classes that were removed
```

Commit the regenerated `content/cac-index.json` so reviewers can see which classes appeared or disappeared.

## Style

- British or American spelling, consistently within a file.
- Plain sentences. No marketing register, no urgency language. The subject supplies its own weight.
- Numbers get a source or an explicit hedge.
- Write for someone competent in an adjacent field, not for a specialist in this one.

## Code of conduct

Be straightforward and assume good faith. This is a domain where people burn out; do not add to that. Harassment, or using this project to target an individual, gets you removed without discussion.
