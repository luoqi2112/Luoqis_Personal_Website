import { flattenCategories } from './bookmarks.js';
import { loadTodos, splitTodos, toggleDone } from './todo.js';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'text') node.textContent = String(v);
    else if (k === 'html') node.innerHTML = String(v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, String(v));
  }
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c === null || c === undefined) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function normStr(v) {
  return String(v ?? '').trim();
}

function includesCI(hay, needle) {
  const h = normStr(hay).toLowerCase();
  const n = normStr(needle).toLowerCase();
  if (!n) return false;
  return h.includes(n);
}

function pickSnippet(fields, query, { maxLen = 86 } = {}) {
  const q = normStr(query);
  for (const f of fields) {
    const s = normStr(f);
    if (!s) continue;
    if (includesCI(s, q)) {
      const idx = s.toLowerCase().indexOf(q.toLowerCase());
      const start = Math.max(0, idx - 18);
      const end = Math.min(s.length, idx + q.length + 42);
      let part = s.slice(start, end);
      if (start > 0) part = '…' + part;
      if (end < s.length) part = part + '…';
      if (part.length > maxLen) part = part.slice(0, maxLen - 1) + '…';
      return part;
    }
  }
  return '';
}

export function highlightHtml(text, query) {
  const t = normStr(text);
  const q = normStr(query);
  if (!t || !q) return escapeHtml(t);

  // case-insensitive, safe for Chinese keywords
  const lower = t.toLowerCase();
  const ql = q.toLowerCase();
  let i = 0;
  let out = '';
  while (i < t.length) {
    const idx = lower.indexOf(ql, i);
    if (idx === -1) {
      out += escapeHtml(t.slice(i));
      break;
    }
    out += escapeHtml(t.slice(i, idx));
    out += `<mark class="siteMark">${escapeHtml(t.slice(idx, idx + q.length))}</mark>`;
    i = idx + q.length;
  }
  return out;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function ensureSiteSearchModal() {
  let overlay = document.getElementById('siteSearchOverlay');
  let modal = document.getElementById('siteSearch');
  if (overlay && modal) return { overlay, modal };

  overlay = el('div', { id: 'siteSearchOverlay', class: 'drawerOverlay', hidden: true });
  modal = el('aside', {
    id: 'siteSearch',
    class: 'drawer',
    'aria-label': '站内搜索结果',
    'aria-hidden': 'true',
    hidden: true
  });

  modal.innerHTML = `
    <div class="drawer__hd">
      <div class="drawer__title">站内搜索结果</div>
      <button id="siteSearchClose" class="btn btn--sm" type="button" aria-label="关闭">✕</button>
    </div>
    <div id="siteSearchBody" class="drawer__body"></div>
  `.trim();

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  return { overlay, modal };
}

function lockBody() {
  const prev = document.body.style.overflow || '';
  document.body.dataset._prevOverflow = prev;
  document.body.classList.add('is-locked');
  document.body.style.overflow = 'hidden';
}

function unlockBody() {
  document.body.classList.remove('is-locked');
  const prev = document.body.dataset._prevOverflow;
  if (typeof prev === 'string') document.body.style.overflow = prev;
  delete document.body.dataset._prevOverflow;
}

export function openSiteSearchModal() {
  const { overlay, modal } = ensureSiteSearchModal();
  overlay.hidden = false;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  lockBody();

  requestAnimationFrame(() => {
    overlay.classList.add('is-open');
    modal.classList.add('is-open');
  });

  modal.querySelector('#siteSearchClose')?.focus();
}

export function closeSiteSearchModal() {
  const overlay = document.getElementById('siteSearchOverlay');
  const modal = document.getElementById('siteSearch');
  if (!overlay || !modal) return;

  overlay.classList.remove('is-open');
  modal.classList.remove('is-open');
  window.setTimeout(() => {
    overlay.hidden = true;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }, 180);

  unlockBody();
}

export function wireSiteSearchModalActions({ drawer, getTodos, setTodos } = {}) {
  const overlay = document.getElementById('siteSearchOverlay');
  const modal = document.getElementById('siteSearch');
  if (!overlay || !modal) return;

  const closeBtn = modal.querySelector('#siteSearchClose');
  overlay.onclick = () => closeSiteSearchModal();
  closeBtn?.addEventListener('click', () => closeSiteSearchModal());

  window.addEventListener('keydown', (e) => {
    const isOpen = !modal.hidden && modal.classList.contains('is-open');
    if (!isOpen) return;
    if (e.key === 'Escape') closeSiteSearchModal();
  });

  modal.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('button[data-todo-toggle]');
    if (!btn) return;
    const id = btn.getAttribute('data-todo-id');
    if (!id) return;

    const cur = getTodos ? getTodos() : loadTodos();
    const next = toggleDone(cur, id);
    if (setTodos) setTodos(next);

    // Reflect UI state immediately.
    const row = btn.closest('.siteResult');
    if (row) row.classList.toggle('is-hit');
  });

  modal.addEventListener('click', (e) => {
    const a = e.target?.closest?.('a[data-site-kind]');
    if (!a) return;

    const kind = a.getAttribute('data-site-kind') || '';
    if (kind === 'photo') {
      const caption = a.getAttribute('data-photo-caption') || '';
      closeSiteSearchModal();
      // Open existing photos drawer and highlight item by caption.
      if (drawer?.open) {
        // Let the page decide content; we can only request opening by triggering existing button.
        document.getElementById('openPhotos')?.click();
        window.setTimeout(() => {
          const candidates = Array.from(document.querySelectorAll('.photoThumb__cap'));
          const hit = candidates.find((x) => normStr(x.textContent) === caption);
          const wrap = hit?.closest?.('.photoThumb');
          if (wrap) {
            wrap.classList.add('is-hit');
            wrap.scrollIntoView({ block: 'center' });
            window.setTimeout(() => wrap.classList.remove('is-hit'), 1200);
          }
        }, 220);
      }
    }
  });
}

function groupByKind(results) {
  const map = { accounts: [], bookmarks: [], photos: [], todos: [] };
  for (const r of results || []) {
    if (!map[r.kind]) map[r.kind] = [];
    map[r.kind].push(r);
  }
  return map;
}

export function performSiteSearch(query, { config, bookmarks, todos } = {}) {
  const q = normStr(query);
  if (!q) return [];

  const out = [];

  // Accounts
  for (const a of (config?.profiles || [])) {
    const hay = [a?.name, a?.title, a?.desc, a?.tag, a?.url, a?.note, (a?.tags || []).join(' ')].join(' ');
    if (includesCI(hay, q)) {
      out.push({
        kind: 'accounts',
        title: normStr(a?.name || a?.title || 'Account'),
        url: a?.url,
        tags: a?.tags || (a?.tag ? [a.tag] : []),
        snippet: pickSnippet([a?.note, a?.desc, a?.url, (a?.tags || []).join(' ')], q),
        raw: a
      });
    }
  }

  // Bookmarks: top + categories
  const top = bookmarks?.top || config?.bookmarks?.top || [];
  for (const b of top) {
    const hay = [b?.name, b?.desc, b?.url, (b?.tags || []).join(' ')].join(' ');
    if (includesCI(hay, q)) {
      out.push({
        kind: 'bookmarks',
        title: normStr(b?.name || 'Bookmark'),
        url: b?.url,
        tags: b?.tags || [],
        snippet: pickSnippet([b?.desc, b?.url, (b?.tags || []).join(' ')], q),
        raw: b
      });
    }
  }

  const cats = bookmarks?.categories || config?.bookmarks?.categories || [];
  for (const c of cats) {
    const catHay = [c?.title, c?.id, c?.icon].join(' ');
    if (includesCI(catHay, q)) {
      out.push({
        kind: 'bookmarks',
        title: `分类：${normStr(c?.title || c?.id || 'Category')}`,
        url: '',
        tags: [],
        snippet: pickSnippet([c?.title, c?.id], q),
        raw: c
      });
    }
  }

  for (const it of flattenCategories(cats)) {
    const hay = [it?.name, it?.desc, it?.url, (it?.tags || []).join(' '), it?._categoryTitle].join(' ');
    if (includesCI(hay, q)) {
      out.push({
        kind: 'bookmarks',
        title: normStr(it?.name || 'Bookmark'),
        url: it?.url,
        tags: [it?._categoryTitle, ...(it?.tags || [])].filter(Boolean),
        snippet: pickSnippet([it?._categoryTitle, it?.desc, it?.url, (it?.tags || []).join(' ')], q),
        raw: it
      });
    }
  }

  // Photos: featured + albums
  const photos = [];
  for (const p of (config?.photos?.featured || [])) photos.push({ ...p, _scope: 'featured' });
  for (const a of (config?.photos?.albums || [])) {
    for (const p of (a?.items || [])) photos.push({ ...p, _scope: a?.title || a?.year || 'album' });
  }

  for (const p of photos) {
    const hay = [p?.caption, p?.title, p?.desc, p?.src, (p?.tags || []).join(' '), p?._scope].join(' ');
    if (includesCI(hay, q)) {
      out.push({
        kind: 'photos',
        title: normStr(p?.caption || p?.title || 'Photo'),
        url: '',
        tags: [p?._scope, ...(p?.tags || [])].filter(Boolean),
        snippet: pickSnippet([p?.desc, p?.src, (p?.tags || []).join(' '), p?._scope], q),
        raw: p
      });
    }
  }

  // Todos (localStorage)
  const list = Array.isArray(todos) ? todos : loadTodos();
  for (const t of list) {
    if (includesCI(t?.text, q)) {
      out.push({
        kind: 'todos',
        title: normStr(t?.text || 'Todo'),
        url: '',
        tags: [t?.done ? '已完成' : '未完成'],
        snippet: pickSnippet([t?.text], q),
        raw: t
      });
    }
  }

  return out;
}

export function renderSiteSearchModal(results, query) {
  const list = Array.isArray(results) ? results : [];
  const q = normStr(query);

  const { overlay, modal } = ensureSiteSearchModal();
  const body = modal.querySelector('#siteSearchBody');
  if (!body) return;

  const grouped = groupByKind(list);
  const total = list.length;

  body.innerHTML = '';
  body.appendChild(
    el('div', { class: 'drawerSection' }, [
      el('div', { class: 'drawerSection__hd' }, [
        el('div', { class: 'drawerSection__title', text: `关键词：${q}` }),
        el('div', { class: 'muted', text: `共 ${total} 条结果` })
      ])
    ])
  );

  const renderGroup = (title, items) => {
    body.appendChild(
      el('div', { class: 'drawerSection' }, [
        el('div', { class: 'drawerSection__hd' }, [
          el('div', { class: 'drawerSection__title', text: `${title} (${items.length})` })
        ]),
        el('div', { class: 'list' }, items.map((r) => renderResultRow(r, q)))
      ])
    );
  };

  renderGroup('Accounts', grouped.accounts);
  renderGroup('Bookmarks', grouped.bookmarks);
  renderGroup('Photography', grouped.photos);
  renderGroup('TODO', grouped.todos);

  openSiteSearchModal();

  // focus trap minimal: keep focus inside modal by focusing close when open
  overlay.hidden = false;
}

function renderResultRow(r, query) {
  const tags = Array.isArray(r?.tags) ? r.tags : [];
  const snippet = r?.snippet || '';

  // URL-based results
  if (r.kind !== 'todos') {
    const a = el('a', {
      class: 'siteResult',
      href: r?.url || '#',
      target: r?.url ? '_blank' : undefined,
      rel: r?.url ? 'noopener noreferrer' : undefined,
      'data-site-kind': r?.kind || '',
      'data-photo-caption': r?.kind === 'photos' ? normStr(r?.title) : undefined
    });

    // if no url (photo / category), prevent navigation
    if (!r?.url) {
      a.href = 'javascript:void(0)';
      a.removeAttribute('target');
      a.removeAttribute('rel');
    }

    a.appendChild(el('div', { class: 'siteResult__title', html: highlightHtml(r?.title || '', query) }));
    if (snippet) a.appendChild(el('div', { class: 'siteResult__snippet', html: highlightHtml(snippet, query) }));
    if (tags.length) {
      a.appendChild(
        el('div', { class: 'siteResult__tags' }, tags.slice(0, 6).map((t) => el('span', { class: 'siteResult__tag', text: t })))
      );
    }
    return a;
  }

  // TODO results (allow toggling)
  const t = r?.raw || {};
  const row = el('div', { class: `siteResult ${t?.done ? '' : 'is-hit'}` });
  row.appendChild(el('div', { class: 'siteResult__title', html: highlightHtml(r?.title || '', query) }));
  if (snippet) row.appendChild(el('div', { class: 'siteResult__snippet', html: highlightHtml(snippet, query) }));

  const actions = el('div', { class: 'siteResult__tags' }, [
    el('span', { class: 'siteResult__tag', text: t?.done ? '已完成' : '未完成' }),
    el('button', {
      class: 'btn btn--sm btn--ghost',
      type: 'button',
      'data-todo-toggle': '1',
      'data-todo-id': t?.id,
      text: t?.done ? '恢复' : '完成'
    })
  ]);
  row.appendChild(actions);
  return row;
}
