/* ICAC Topic Tracker — client
 *
 * No framework, no build step, no dependencies. Data is fetched once from
 * site/data/, which tools/build.py generates from content/. Routing is hash
 * based so the whole thing works as static files on GitHub Pages, and every
 * view is deep-linkable.
 *
 * Routes
 *   #/                          domain cards
 *   #/d/:domain                 categories in a domain
 *   #/d/:domain/:category       topics in a category
 *   #/t/:topic                  topic detail
 *   #/topics                    all topics, filterable
 *   #/threads                   every actionable thread across all topics
 *   #/future-threats            horizon shifts and research gaps, filed onto topics
 *   #/ontology                  CAC module coverage
 *   #/about                     scope and sources
 */
'use strict';

const DATA = {};
const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
const crumbs = $('#crumbs');

/* ---------- utilities ---------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** Look up a facet value's label from the taxonomy, falling back to the raw id. */
function facetLabel(facetName, id, group = 'facets') {
  const facet = DATA.taxonomy[group]?.[facetName];
  const hit = facet?.values?.find((v) => v.id === id);
  return hit ? hit.label : id;
}

function domainOf(id) {
  return DATA.taxonomy.domains.find((d) => d.id === id);
}
function categoryOf(domainId, catId) {
  return domainOf(domainId)?.categories.find((c) => c.id === catId);
}
function topicOf(id) {
  return DATA.topics.find((t) => t.id === id);
}

const ACTIONABLE = new Set(['open', 'claimed', 'in_progress', 'needs_review']);

function cacBadge(status) {
  return `<span class="badge dot ${esc(status)}">${esc(facetLabel('cac_status', status))}</span>`;
}

function setCrumbs(parts) {
  crumbs.innerHTML = parts
    .map((p, i) => {
      const last = i === parts.length - 1;
      const node = last || !p.href
        ? `<span class="muted">${esc(p.label)}</span>`
        : `<a href="${esc(p.href)}">${esc(p.label)}</a>`;
      return i === 0 ? node : `<span>/</span>${node}`;
    })
    .join('');
}

function emptyState(title, detail) {
  return `<div class="empty"><p class="empty-title">${esc(title)}</p><p class="muted">${esc(detail)}</p></div>`;
}

/* ---------- shared fragments ---------- */

function topicCard(t) {
  const n = t.thread_counts.actionable;
  return `
    <a class="card" href="#/t/${esc(t.id)}">
      <h3>${esc(t.label)}</h3>
      <p>${esc(t.definition.slice(0, 165))}${t.definition.length > 165 ? '…' : ''}</p>
      <div class="badges">
        ${cacBadge(t.cac_alignment.status)}
        <span class="badge">${esc(facetLabel('maturity', t.maturity))}</span>
        ${n ? `<span class="badge">${plural(n, 'open thread')}</span>` : ''}
      </div>
    </a>`;
}

function threadCard(t, topic) {
  const skills = (t.skills || []).map((s) => `<span class="badge">${esc(facetLabel('skills', s, 'thread_facets'))}</span>`).join('');
  const done = (t.done_when || []).map((d) => `<li>${esc(d)}</li>`).join('');
  return `
    <article class="thread st-${esc(t.status)}">
      <h3>${esc(t.title)}</h3>
      ${topic ? `<p class="small muted" style="margin-bottom:8px">In <a href="#/t/${esc(topic.id)}">${esc(topic.label)}</a></p>` : ''}
      ${t.detail ? `<p>${esc(t.detail)}</p>` : ''}
      ${done ? `<div><h4 class="small muted" style="margin:0;font-weight:600">Done when</h4><ul class="done-when">${done}</ul></div>` : ''}
      <div class="thread-meta">
        <span class="badge">${esc(facetLabel('status', t.status, 'thread_facets'))}</span>
        <span class="badge">${esc(facetLabel('kind', t.kind, 'thread_facets'))}</span>
        <span class="badge">${esc(facetLabel('effort', t.effort, 'thread_facets'))}</span>
        ${skills}
        ${t.claimed_by ? `<span class="badge">${esc(t.claimed_by)}</span>` : ''}
      </div>
      ${t.outcome ? `<p class="small" style="margin-top:10px"><strong>Outcome:</strong> ${esc(t.outcome)}</p>` : ''}
    </article>`;
}

function referenceList(refs) {
  const types = Object.fromEntries((DATA.taxonomy.reference_types || []).map((r) => [r.id, r.label]));
  return `<ul class="refs">${refs.map((r) => `
    <li>
      <a class="r-title" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a>
      <div class="r-meta">${[types[r.type] || r.type, r.publisher, r.date].filter(Boolean).map(esc).join(' · ')}</div>
      ${r.note ? `<div class="r-note">${esc(r.note)}</div>` : ''}
    </li>`).join('')}</ul>`;
}

/* ---------- views ---------- */

function viewHome() {
  setCrumbs([{ label: 'Domains' }]);
  const m = DATA.manifest.counts;
  view.innerHTML = `
    <div class="page-head">
      <h1>Issues, topics, and challenges in the ICAC space</h1>
      <p>
        Tracking the problems in Internet Crimes Against Children so engineers,
        researchers, and other professionals can see them clearly and design
        interdictions. Pick a domain, drill into a category, and take a thread.
      </p>
    </div>

    <div class="stat-row">
      <div class="stat"><b>${m.topics}</b><span>Topics</span></div>
      <div class="stat"><b>${m.actionable_threads}</b><span>Open threads</span></div>
      <div class="stat"><b>${m.categories}</b><span>Categories</span></div>
      <div class="stat"><b>${m.cac_classes}</b><span>CAC classes indexed</span></div>
    </div>

    <h2>Domains</h2>
    <div class="grid domain-grid">
      ${DATA.taxonomy.domains.map((d) => `
        <a class="card domain-card" data-domain="${esc(d.id)}" href="#/d/${esc(d.id)}" style="--accent:${esc(d.accent)}">
          <h3>${esc(d.label)}</h3>
          <p>${esc(d.blurb)}</p>
          <div class="card-foot">
            <span><b>${d.topic_count}</b> ${d.topic_count === 1 ? 'topic' : 'topics'}</span>
            <span><b>${d.actionable_threads}</b> open</span>
            <span><b>${d.categories.length}</b> categories</span>
          </div>
        </a>`).join('')}
    </div>`;
}

function viewDomain(domainId) {
  const d = domainOf(domainId);
  if (!d) return notFound('domain', domainId);
  setCrumbs([{ label: 'Domains', href: '#/' }, { label: d.label }]);

  view.innerHTML = `
    <div class="page-head">
      <h1>${esc(d.label)}</h1>
      <p>${esc(d.blurb)}</p>
    </div>
    <h2>Categories</h2>
    <div class="cat-list">
      ${d.categories.map((c) => `
        <a class="cat-row" href="#/d/${esc(d.id)}/${esc(c.id)}">
          <span class="cat-name">${esc(c.label)}</span>
          <span class="cat-blurb">${esc(c.blurb)}</span>
          <span class="cat-count">${c.topic_count} · ${c.actionable_threads} open</span>
        </a>`).join('')}
    </div>`;
}

function viewCategory(domainId, catId) {
  const d = domainOf(domainId);
  const c = categoryOf(domainId, catId);
  if (!d || !c) return notFound('category', `${domainId}/${catId}`);
  setCrumbs([
    { label: 'Domains', href: '#/' },
    { label: d.label, href: `#/d/${d.id}` },
    { label: c.label },
  ]);

  const topics = DATA.topics.filter((t) => t.domain === domainId && t.category === catId);
  const modules = (c.cac_modules || [])
    .map((id) => DATA.cac?.modules.find((m) => m.id === id))
    .filter(Boolean);

  view.innerHTML = `
    <div class="page-head">
      <h1>${esc(c.label)}</h1>
      <p>${esc(c.blurb)}</p>
    </div>
    ${modules.length ? `<p class="small muted">Ontology coverage: ${modules
      .map((m) => `<a href="#/ontology">${esc(m.label)}</a>`).join(', ')}</p>` : ''}
    <h2>${plural(topics.length, 'topic')}</h2>
    ${topics.length
      ? `<div class="grid grid-2">${topics.map(topicCard).join('')}</div>`
      : emptyState('No topics here yet', 'This category is scaffolded but empty. Contributions welcome — see CONTRIBUTING.md.')}`;
}

function viewTopic(id) {
  const t = topicOf(id);
  if (!t) return notFound('topic', id);
  const d = domainOf(t.domain);
  const c = categoryOf(t.domain, t.category);
  setCrumbs([
    { label: 'Domains', href: '#/' },
    { label: d?.label || t.domain, href: `#/d/${t.domain}` },
    { label: c?.label || t.category, href: `#/d/${t.domain}/${t.category}` },
    { label: t.label },
  ]);

  const threads = t.threads || [];
  const openThreads = threads.filter((x) => ACTIONABLE.has(x.status));
  const closedThreads = threads.filter((x) => !ACTIONABLE.has(x.status));
  const al = t.cac_alignment;

  const facetBlock = (name, values) => {
    if (!values?.length) return '';
    return `<div class="aside-block">
      <h4>${esc(DATA.taxonomy.facets[name]?.label || name)}</h4>
      <ul>${values.map((v) => `<li>${esc(facetLabel(name, v))}</li>`).join('')}</ul>
    </div>`;
  };

  const related = (t.related_topics || []).map(topicOf).filter(Boolean);

  view.innerHTML = `
    <div class="page-head">
      <h1>${esc(t.label)}</h1>
      ${t.aliases?.length ? `<p class="small muted">Also called: ${t.aliases.map(esc).join(' · ')}</p>` : ''}
      <div class="badges">
        ${cacBadge(al.status)}
        <span class="badge">${esc(facetLabel('maturity', t.maturity))}</span>
        ${openThreads.length ? `<span class="badge">${plural(openThreads.length, 'open thread')}</span>` : ''}
      </div>
    </div>

    <div class="detail">
      <div class="prose">
        <p>${esc(t.definition)}</p>

        ${t.why_it_matters ? `<h2>Why it matters</h2><p>${esc(t.why_it_matters)}</p>` : ''}
        ${t.current_understanding ? `<h2>Current understanding</h2><p>${esc(t.current_understanding)}</p>` : ''}

        ${t.open_questions?.length ? `
          <h2>Open questions</h2>
          <ul class="qlist">${t.open_questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}

        <h2>CAC ontology alignment</h2>
        ${al.notes ? `<p>${esc(al.notes)}</p>` : ''}
        ${al.resolved?.length ? `<div>${al.resolved.map((cl) => `
          <div class="class-row">
            <div class="cn">${esc(cl.label)} <span class="small muted">· ${esc(cl.module)}</span></div>
            ${cl.comment ? `<p class="cc">${esc(cl.comment)}</p>` : ''}
            <code class="iri">${esc(cl.iri)}</code>
          </div>`).join('')}</div>`
          : `<p class="muted">No CAC classes are mapped to this topic yet.</p>`}

        ${threads.length ? `<h2>Threads — work you can pick up</h2>
          ${openThreads.map((x) => threadCard(x, null)).join('')}
          ${closedThreads.length ? `<h2>Closed threads</h2>${closedThreads.map((x) => threadCard(x, null)).join('')}` : ''}`
          : ''}

        <h2>References</h2>
        ${referenceList(t.references || [])}
      </div>

      <aside class="aside">
        <div class="aside-block">
          <h4>Filed under</h4>
          <ul>
            <li><a href="#/d/${esc(t.domain)}">${esc(d?.label || t.domain)}</a></li>
            <li><a href="#/d/${esc(t.domain)}/${esc(t.category)}">${esc(c?.label || t.category)}</a></li>
          </ul>
        </div>
        ${facetBlock('intervention_point', t.intervention_point)}
        ${facetBlock('affordance_class', t.affordance_class)}
        ${facetBlock('lifecycle_stage', t.lifecycle_stage)}
        ${related.length ? `<div class="aside-block">
          <h4>Related topics</h4>
          <ul>${related.map((r) => `<li><a href="#/t/${esc(r.id)}">${esc(r.label)}</a></li>`).join('')}</ul>
        </div>` : ''}
        <div class="aside-block">
          <h4>Record</h4>
          <ul>
            <li>Added ${esc(t.created)}</li>
            <li>Updated ${esc(t.updated)}</li>
            ${t.maintainers?.length ? `<li>${t.maintainers.map(esc).join(', ')}</li>` : ''}
          </ul>
          <p class="small" style="margin:9px 0 0">
            <a href="https://github.com/mrinaalr/ICAC-Topic-Tracker/blob/main/${esc(t._source)}"
               target="_blank" rel="noopener noreferrer">Edit this topic</a>
          </p>
        </div>
      </aside>
    </div>`;
}

function viewAllTopics() {
  setCrumbs([{ label: 'Domains', href: '#/' }, { label: 'All topics' }]);
  const sel = (id, label, opts) => `
    <label for="${id}">${label}</label>
    <select id="${id}"><option value="">Any</option>${opts}</select>`;

  view.innerHTML = `
    <div class="page-head">
      <h1>All topics</h1>
      <p>Every tracked concept, filterable across domain, ontology alignment, and maturity.</p>
    </div>
    <div class="filters">
      ${sel('f-domain', 'Domain', DATA.taxonomy.domains.map((d) => `<option value="${esc(d.id)}">${esc(d.label)}</option>`).join(''))}
      ${sel('f-cac', 'Alignment', DATA.taxonomy.facets.cac_status.values.map((v) => `<option value="${esc(v.id)}">${esc(v.label)}</option>`).join(''))}
      ${sel('f-mat', 'Maturity', DATA.taxonomy.facets.maturity.values.map((v) => `<option value="${esc(v.id)}">${esc(v.label)}</option>`).join(''))}
      ${sel('f-int', 'Intervention', DATA.taxonomy.facets.intervention_point.values.map((v) => `<option value="${esc(v.id)}">${esc(v.label)}</option>`).join(''))}
      <span class="spacer"></span>
      <span class="count" id="f-count"></span>
      <button class="btn-link" id="f-reset" type="button">Reset</button>
    </div>
    <div class="grid grid-2" id="topic-grid"></div>`;

  const apply = () => {
    const dv = $('#f-domain').value, cv = $('#f-cac').value, mv = $('#f-mat').value, iv = $('#f-int').value;
    const hits = DATA.topics.filter((t) =>
      (!dv || t.domain === dv) &&
      (!cv || t.cac_alignment.status === cv) &&
      (!mv || t.maturity === mv) &&
      (!iv || (t.intervention_point || []).includes(iv)));
    $('#topic-grid').innerHTML = hits.length
      ? hits.map(topicCard).join('')
      : emptyState('Nothing matches', 'Try widening the filters.');
    $('#f-count').textContent = `${hits.length} of ${DATA.topics.length}`;
  };
  ['f-domain', 'f-cac', 'f-mat', 'f-int'].forEach((id) => $('#' + id).addEventListener('change', apply));
  $('#f-reset').addEventListener('click', () => {
    ['f-domain', 'f-cac', 'f-mat', 'f-int'].forEach((id) => { $('#' + id).value = ''; });
    apply();
  });
  apply();
}

function viewThreads() {
  setCrumbs([{ label: 'Domains', href: '#/' }, { label: 'Open work' }]);
  const rows = [];
  for (const t of DATA.topics) {
    for (const th of t.threads || []) {
      if (ACTIONABLE.has(th.status)) rows.push({ thread: th, topic: t });
    }
  }
  const tf = DATA.taxonomy.thread_facets;

  view.innerHTML = `
    <div class="page-head">
      <h1>Open work</h1>
      <p>
        Every actionable thread across every topic. Each one names what it is,
        roughly how big it is, and what would count as done. Claim one by opening
        an issue on the repository.
      </p>
    </div>
    <div class="filters">
      <label for="t-kind">Kind</label>
      <select id="t-kind"><option value="">Any</option>${tf.kind.values.map((v) => `<option value="${esc(v.id)}">${esc(v.label)}</option>`).join('')}</select>
      <label for="t-effort">Effort</label>
      <select id="t-effort"><option value="">Any</option>${tf.effort.values.map((v) => `<option value="${esc(v.id)}">${esc(v.label)}</option>`).join('')}</select>
      <label for="t-skill">Skill</label>
      <select id="t-skill"><option value="">Any</option>${tf.skills.values.map((v) => `<option value="${esc(v.id)}">${esc(v.label)}</option>`).join('')}</select>
      <span class="spacer"></span>
      <span class="count" id="t-count"></span>
      <button class="btn-link" id="t-reset" type="button">Reset</button>
    </div>
    <div id="thread-list"></div>`;

  const apply = () => {
    const k = $('#t-kind').value, e = $('#t-effort').value, s = $('#t-skill').value;
    const hits = rows.filter(({ thread }) =>
      (!k || thread.kind === k) &&
      (!e || thread.effort === e) &&
      (!s || (thread.skills || []).includes(s)));
    $('#thread-list').innerHTML = hits.length
      ? hits.map(({ thread, topic }) => threadCard(thread, topic)).join('')
      : emptyState('Nothing matches', 'Try widening the filters.');
    $('#t-count').textContent = `${hits.length} of ${rows.length}`;
  };
  ['t-kind', 't-effort', 't-skill'].forEach((id) => $('#' + id).addEventListener('change', apply));
  $('#t-reset').addEventListener('click', () => {
    ['t-kind', 't-effort', 't-skill'].forEach((id) => { $('#' + id).value = ''; });
    apply();
  });
  apply();
}

async function viewOntology() {
  setCrumbs([{ label: 'Domains', href: '#/' }, { label: 'Ontology' }]);
  view.innerHTML = '<p class="muted">Loading ontology index…</p>';
  await loadCac();

  const meta = DATA.cac._meta;
  const used = DATA.cac.modules.filter((m) => m.referenced_class_count > 0)
    .sort((a, b) => b.referenced_class_count - a.referenced_class_count);
  const unused = DATA.cac.modules.filter((m) => m.referenced_class_count === 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  view.innerHTML = `
    <div class="page-head">
      <h1>CAC ontology coverage</h1>
      <p>
        Topics here are anchored to the Crimes Against Children Ontology, so a
        concept on this site can be traced to a formally defined class rather than
        to a label someone invented. Every declared class is checked against a
        vendored index of the ontology at build time.
      </p>
    </div>

    <div class="stat-row">
      <div class="stat"><b>${meta.class_count}</b><span>Classes indexed</span></div>
      <div class="stat"><b>${meta.module_count}</b><span>Modules</span></div>
      <div class="stat"><b>${DATA.manifest.counts.cac_classes_referenced}</b><span>Classes cited here</span></div>
      <div class="stat"><b>${used.length}</b><span>Modules touched</span></div>
    </div>

    <p class="small muted">
      Source: <a href="${esc(meta.source)}" target="_blank" rel="noopener noreferrer">${esc(meta.source)}</a>
      · shepherded by ${esc(meta.shepherd || 'Project VIC International')} · ${esc(meta.license)}
    </p>

    <h2>Modules referenced by topics</h2>
    <div class="cat-list">
      ${used.map((m) => `
        <div class="cat-row">
          <span class="cat-name">${esc(m.label)}</span>
          <span class="cat-blurb">${esc(m.id)}${m.version ? ` · v${esc(m.version)}` : ''}</span>
          <span class="cat-count">${m.referenced_class_count} of ${m.class_count} cited</span>
        </div>`).join('')}
    </div>

    <h2>Modules not yet referenced</h2>
    <p class="muted small">
      Coverage of the ontology by this tracker, not a judgement on the ontology.
      These modules describe parts of the domain no topic here has reached yet.
    </p>
    <div class="grid grid-3">
      ${unused.map((m) => `
        <div class="card">
          <h3 style="font-size:14.5px">${esc(m.label)}</h3>
          <p>${plural(m.class_count, 'class', 'classes')}</p>
        </div>`).join('')}
    </div>`;
}

function mapsHref(item) {
  if (item.topic && topicOf(item.topic)) return `#/t/${item.topic}`;
  if (item.domain && item.category) return `#/d/${item.domain}/${item.category}`;
  if (item.domain) return `#/d/${item.domain}`;
  return '#/future-threats';
}

function mapsMeta(item) {
  const t = item.topic ? topicOf(item.topic) : null;
  if (t) {
    const d = domainOf(t.domain);
    const c = categoryOf(t.domain, t.category);
    return `${d?.label || t.domain} › ${c?.label || t.category}`;
  }
  const d = item.domain ? domainOf(item.domain) : null;
  const c = item.domain && item.category ? categoryOf(item.domain, item.category) : null;
  if (c) return `${d?.label || item.domain} › ${c.label}`;
  if (d) return d.label;
  return '';
}

function mapsCoverage(item) {
  if (item.topic && topicOf(item.topic)) {
    return `<span class="badge tracked">Tracked</span>`;
  }
  const c = item.domain && item.category ? categoryOf(item.domain, item.category) : null;
  if (c) {
    return c.topic_count
      ? `<span class="badge">${plural(c.topic_count, 'topic')}</span>`
      : `<span class="badge scaffolded">Scaffolded</span>`;
  }
  return '';
}

function priorityRow(item) {
  const href = mapsHref(item);
  const meta = mapsMeta(item);
  return `
    <a class="cat-row" href="${esc(href)}">
      <span class="cat-name">${esc(item.label)}</span>
      <span class="cat-blurb">${esc(meta)}</span>
      <span class="cat-count">${mapsCoverage(item)}</span>
    </a>`;
}

function viewFutureThreats() {
  setCrumbs([{ label: 'Domains', href: '#/' }, { label: 'Future threats' }]);
  const fw = DATA.futureWork;
  const domain = domainOf('future-threats');
  const topics = DATA.topics.filter((t) => t.domain === 'future-threats');
  const threads = [];
  for (const t of topics) {
    for (const th of t.threads || []) {
      if (ACTIONABLE.has(th.status)) threads.push({ thread: th, topic: t });
    }
  }

  if (!fw) {
    view.innerHTML = emptyState(
      'Future-work brief not built',
      'Run python3 tools/build.py to generate site/data/future-work.json, then reload.'
    );
    return;
  }

  const technical = fw.research_priorities?.technical || [];
  const policy = fw.research_priorities?.policy || [];
  const tracked = [...technical, ...policy].filter((i) => i.topic && topicOf(i.topic)).length;
  const scaffolded = [...technical, ...policy].filter((i) => !(i.topic && topicOf(i.topic))).length;

  view.innerHTML = `
    <div class="page-head">
      <h1>Future threats</h1>
      <p>${esc(fw.framing)}</p>
    </div>

    <div class="notice">
      <strong>A map, not a second catalogue.</strong> Each shift and research
      priority is filed against a topic in this tracker where one exists, or
      against a taxonomy slot that is still empty. Public sources only — see
      <a href="#/about">scope</a>.
    </div>

    <div class="stat-row">
      <div class="stat"><b>${(fw.structural_shifts || []).length}</b><span>Structural shifts</span></div>
      <div class="stat"><b>${topics.length}</b><span>Topics in this domain</span></div>
      <div class="stat"><b>${tracked}</b><span>Priorities with a topic</span></div>
      <div class="stat"><b>${scaffolded}</b><span>Priorities still empty</span></div>
    </div>

    <h2>How the offense changed</h2>
    <p class="muted small" style="margin-top:-6px;margin-bottom:14px">
      Four avenues named in the
      <a href="${esc(fw.sources?.[1]?.url || '#')}" target="_blank" rel="noopener noreferrer">Future Threats</a>
      note. Each one is a topic, with ontology alignment and work someone can pick up.
    </p>
    <div class="grid shift-grid">
      ${(fw.structural_shifts || []).map((s) => {
        const t = topicOf(s.topic);
        return `
          <a class="card domain-card" href="${esc(mapsHref(s))}" style="--accent:${esc(domain?.accent || '#0e7490')}">
            <h3>${esc(s.label)}</h3>
            <p>${esc(s.summary)}</p>
            <div class="card-foot">
              <span>${t ? esc(t.label) : 'Unfiled'}</span>
              ${t ? cacBadge(t.cac_alignment.status) : ''}
            </div>
          </a>`;
      }).join('')}
    </div>

    <h2>Research priorities</h2>
    <p class="muted small" style="margin-top:-6px;margin-bottom:14px">
      From
      <a href="${esc(fw.sources?.[0]?.url || '#')}" target="_blank" rel="noopener noreferrer">Future Work &amp; Research Gaps</a>.
      Tracked means a topic exists. Scaffolded means the category is in the
      taxonomy and empty — a filing location waiting for a topic.
    </p>
    <div class="filters">
      <label for="p-group">Group</label>
      <select id="p-group">
        <option value="">All</option>
        <option value="technical">Technical</option>
        <option value="policy">Legal &amp; policy</option>
      </select>
      <label for="p-cov">Coverage</label>
      <select id="p-cov">
        <option value="">Any</option>
        <option value="tracked">Has a topic</option>
        <option value="scaffolded">Still empty</option>
      </select>
      <span class="spacer"></span>
      <span class="count" id="p-count"></span>
      <button class="btn-link" id="p-reset" type="button">Reset</button>
    </div>
    <div id="prio-list"></div>

    <h2>Open questions</h2>
    <ul class="qlist">${(fw.horizon_questions || []).map((q) => `<li>${esc(q)}</li>`).join('')}</ul>

    <h2>${plural(topics.length, 'topic')} in this domain</h2>
    ${topics.length
      ? `<div class="grid grid-2">${topics.map(topicCard).join('')}</div>`
      : emptyState('No topics here yet', 'The domain is scaffolded. Contributions welcome.')}

    ${threads.length ? `<h2>Open work in this domain</h2>
      ${threads.map(({ thread, topic }) => threadCard(thread, topic)).join('')}` : ''}

    <h2>Sources</h2>
    ${referenceList(fw.sources || [])}`;

  const rows = [
    ...technical.map((i) => ({ ...i, group: 'technical' })),
    ...policy.map((i) => ({ ...i, group: 'policy' })),
  ];
  const isTracked = (i) => !!(i.topic && topicOf(i.topic));
  const apply = () => {
    const g = $('#p-group').value, c = $('#p-cov').value;
    const hits = rows.filter((i) =>
      (!g || i.group === g) &&
      (!c || (c === 'tracked' ? isTracked(i) : !isTracked(i))));
    $('#prio-list').innerHTML = hits.length
      ? `<div class="cat-list">${hits.map(priorityRow).join('')}</div>`
      : emptyState('Nothing matches', 'Try widening the filters.');
    $('#p-count').textContent = `${hits.length} of ${rows.length}`;
  };
  ['p-group', 'p-cov'].forEach((id) => $('#' + id).addEventListener('change', apply));
  $('#p-reset').addEventListener('click', () => {
    ['p-group', 'p-cov'].forEach((id) => { $('#' + id).value = ''; });
    apply();
  });
  apply();
}

function viewAbout() {
  setCrumbs([{ label: 'Domains', href: '#/' }, { label: 'About' }]);
  const m = DATA.manifest;
  view.innerHTML = `
    <div class="page-head">
      <h1>About &amp; scope</h1>
      <p>What this is, what it deliberately is not, and where the material comes from.</p>
    </div>

    <div class="detail">
      <div class="prose">
        <p>
          The ICAC Topic Tracker was created to track issues, topics, and challenges
          in the Internet Crimes Against Children space, so that engineers,
          researchers, and other professionals can cleanly see the issues and design
          interdictions against them.
        </p>
        <p>
          Each entry is a <strong>topic</strong> — a concept the field actually
          discusses — with a definition, the state of play, open questions, and
          <strong>threads</strong>: concrete pieces of work someone can pick up, each
          with criteria for what would count as finished. Topics are anchored to the
          CAC Ontology so that a concept here maps to a formally defined class rather
          than to ad-hoc terminology.
        </p>

        <h2>Scope</h2>
        <div class="notice">
          <strong>Public sources only.</strong> Every reference on this site must be a
          publicly reachable URL that anyone can open without credentials. This is not
          a tip line, not a case-management system, not an investigation tool, and not
          a place for law enforcement data, victim or offender identification, or
          material from restricted systems. Contributions that would require any of
          those are out of scope and will be declined.
        </div>
        <p>
          The tracker deals in concepts and open problems, not in cases. Where a case
          is cited, it is cited as a published record — a press release, a charging
          document already in the public domain, or reporting on it — and only to
          illustrate a pattern.
        </p>

        <h2>Sources and prior work</h2>
        <p>
          The taxonomy borrows its analytical vocabulary — affordance classes,
          exploitation lifecycle stages, and intervention points — from published
          research on platform affordances and ICAC enforcement records, cited on the
          topics that use it. The ontology anchoring uses the CAC Ontology family
          shepherded by Project VIC International, which itself builds on the Cyber
          Domain Ontology stack.
        </p>
        <ul>
          <li><a href="https://github.com/Project-VIC-International/CAC-Ontology" target="_blank" rel="noopener noreferrer">CAC Ontology</a> — Project VIC International (Apache-2.0)</li>
          <li><a href="https://caseontology.org/" target="_blank" rel="noopener noreferrer">CASE</a> and <a href="https://unifiedcyberontology.org/" target="_blank" rel="noopener noreferrer">UCO</a> — the standards CAC extends</li>
          <li><a href="https://doi.org/10.5281/zenodo.21347781" target="_blank" rel="noopener noreferrer">Affordances for Harm</a> — the affordance / misuse / harm decomposition used across the taxonomy</li>
          <li><a href="https://github.com/mrinaalr/CaseLinker" target="_blank" rel="noopener noreferrer">CaseLinker</a> — open-source analysis of public ICAC enforcement records</li>
          <li><a href="https://end-child-exploitation.com/" target="_blank" rel="noopener noreferrer">End Child Exploitation</a> — background research notes</li>
        </ul>

        <h2>Contributing</h2>
        <p>
          Topics are plain YAML files in the repository, validated in CI against a
          JSON Schema, the taxonomy, and the ontology index. Add or edit one by
          opening a pull request. Full instructions are in
          <a href="https://github.com/mrinaalr/ICAC-Topic-Tracker/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">CONTRIBUTING.md</a>.
        </p>
      </div>

      <aside class="aside">
        <div class="aside-block">
          <h4>This build</h4>
          <ul>
            <li>${m.counts.topics} topics</li>
            <li>${m.counts.threads} threads (${m.counts.actionable_threads} actionable)</li>
            <li>${m.counts.references} references</li>
            <li>${m.counts.cac_classes} CAC classes indexed</li>
            <li>Built ${esc(m.built_at.slice(0, 10))}</li>
            ${m.git_rev ? `<li>Revision ${esc(m.git_rev)}</li>` : ''}
          </ul>
        </div>
        <div class="aside-block">
          <h4>Licence</h4>
          <ul>
            <li>Code — MIT</li>
            <li>Content — CC BY 4.0</li>
          </ul>
        </div>
      </aside>
    </div>`;
}

function notFound(what, id) {
  setCrumbs([{ label: 'Domains', href: '#/' }, { label: 'Not found' }]);
  view.innerHTML = emptyState(
    `No such ${what}`,
    `Nothing here is called “${id}”. It may have been renamed or removed.`
  );
}

/* ---------- search ---------- */

function initSearch() {
  const input = $('#q');
  const box = $('#suggest');
  let active = -1;
  let results = [];

  const close = () => { box.hidden = true; active = -1; };

  const render = () => {
    if (!results.length) { close(); return; }
    box.innerHTML = results.map((r, i) => {
      const d = domainOf(r.d), c = categoryOf(r.d, r.c);
      return `<a href="#/t/${esc(r.id)}" data-i="${i}" class="${i === active ? 'active' : ''}">
        <div class="s-label">${esc(r.l)}</div>
        <div class="s-path">${esc(d?.label || r.d)} › ${esc(c?.label || r.c)}${r.n ? ` · ${plural(r.n, 'open thread')}` : ''}</div>
      </a>`;
    }).join('');
    box.hidden = false;
  };

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { results = []; close(); return; }
    results = DATA.index
      .map((r) => {
        let score = 0;
        if (r.l.toLowerCase().startsWith(q)) score += 100;
        else if (r.l.toLowerCase().includes(q)) score += 60;
        if (r.a.some((a) => a.toLowerCase().includes(q))) score += 40;
        if (r.t.includes(q)) score += 10;
        return { ...r, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    active = -1;
    render();
  });

  input.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, results.length - 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); location.hash = `#/t/${results[active].id}`; input.blur(); close(); }
    else if (e.key === 'Escape') { close(); input.blur(); }
  });

  box.addEventListener('click', () => { input.value = ''; close(); });
  document.addEventListener('click', (e) => {
    if (!box.contains(e.target) && e.target !== input) close();
  });

  // "/" focuses search, the way every code-forge search box behaves.
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      e.preventDefault();
      input.focus();
    }
  });
}

/* ---------- theme ---------- */

function initTheme() {
  const btn = $('#theme-toggle');
  let stored = null;
  try { stored = localStorage.getItem('itt-theme'); } catch { /* private mode */ }
  if (stored === 'dark' || stored === 'light') {
    document.documentElement.setAttribute('data-theme', stored);
  }
  btn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
    const next = cur ? (cur === 'dark' ? 'light' : 'dark') : (sysDark ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('itt-theme', next); } catch { /* ignore */ }
  });
}

/* ---------- routing ---------- */

let cacLoaded = false;
async function loadCac() {
  if (cacLoaded) return;
  DATA.cac = await (await fetch('data/cac.json')).json();
  cacLoaded = true;
}

function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);

  document.querySelectorAll('.topnav a').forEach((a) => a.removeAttribute('aria-current'));
  const markNav = (href) => {
    const a = document.querySelector(`.topnav a[href="${href}"]`);
    if (a) a.setAttribute('aria-current', 'page');
  };

  window.scrollTo(0, 0);

  if (!parts.length) { markNav('#/'); return viewHome(); }
  switch (parts[0]) {
    case 'd':
      markNav(parts[1] === 'future-threats' ? '#/future-threats' : '#/');
      return parts.length >= 3 ? viewCategory(parts[1], parts[2]) : viewDomain(parts[1]);
    case 't':
      if (topicOf(parts[1])?.domain === 'future-threats') markNav('#/future-threats');
      return viewTopic(parts[1]);
    case 'topics':
      markNav('#/topics');
      return viewAllTopics();
    case 'threads':
      markNav('#/threads');
      return viewThreads();
    case 'future-threats':
      markNav('#/future-threats');
      return viewFutureThreats();
    case 'ontology':
      markNav('#/ontology');
      return viewOntology();
    case 'about':
      markNav('#/about');
      return viewAbout();
    default:
      return notFound('page', parts[0]);
  }
}

/* ---------- boot ---------- */

async function boot() {
  try {
    const [manifest, taxonomy, topics, index, futureWork] = await Promise.all([
      fetch('data/manifest.json').then((r) => r.json()),
      fetch('data/taxonomy.json').then((r) => r.json()),
      fetch('data/topics.json').then((r) => r.json()),
      fetch('data/index.json').then((r) => r.json()),
      fetch('data/future-work.json').then((r) => r.ok ? r.json() : null),
    ]);
    Object.assign(DATA, { manifest, taxonomy, topics, index, futureWork });
  } catch (err) {
    view.innerHTML = emptyState(
      'Could not load the tracker data',
      'Run python3 tools/build.py to generate site/data/, then reload.'
    );
    console.error(err);
    return;
  }

  $('#build-meta').textContent =
    `${DATA.manifest.counts.topics} topics · ${DATA.manifest.counts.actionable_threads} open threads · built ${DATA.manifest.built_at.slice(0, 10)}`;

  initTheme();
  initSearch();
  addEventListener('hashchange', route);
  route();
}

boot();
