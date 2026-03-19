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

export function applySiteMeta(config) {
  document.documentElement.lang = config?.site?.language || 'zh-CN';
  document.title = config?.site?.title || 'Start Page';

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  const homeLink = document.getElementById('homeLink');
  const footerHome = document.getElementById('footerHome');
  const githubLink = document.getElementById('githubLink');
  if (homeLink) homeLink.href = config?.site?.homeUrl || '#';
  if (footerHome) footerHome.href = config?.site?.homeUrl || '#';
  if (githubLink) githubLink.href = config?.site?.githubUrl || '#';
}

export function renderProfileCard(config) {
  const p = config?.profile;
  const avatar = document.getElementById('avatar');
  const avatarIcon = document.getElementById('avatarIcon');
  const name = document.getElementById('profileName');
  const handle = document.getElementById('profileHandle');
  const bio = document.getElementById('profileBio');
  const hobbies = document.getElementById('profileHobbies');

  // 头像替换方式：
  // 1) 直接替换文件 `assets/avatar.jpg`；或
  // 2) 修改 `data/config.json` 的 `profile.avatarSrc` 指向你自己的图片路径。
  // 若图片不存在/加载失败，会自动显示一个占位（避免破图）。
  if (avatar) {
    const showFallback = () => {
      // 进入 fallback：必须隐藏 img，避免浏览器继续渲染旧 bitmap（缓存画面）造成叠加。
      avatar.hidden = true;
      avatar.removeAttribute('src');
      avatar.setAttribute('data-fallback', 'true');
      if (avatarIcon) avatarIcon.hidden = false;
    };
    const showImage = () => {
      // 进入 image：显示 img，隐藏占位。
      avatar.hidden = false;
      avatar.removeAttribute('data-fallback');
      if (avatarIcon) avatarIcon.hidden = true;
    };

    // 每次渲染先把状态重置到一致（防止多次调用后残留）。
    // 默认先隐藏占位、显示 img（等待加载结果）。
    if (avatarIcon) avatarIcon.hidden = true;
    avatar.hidden = false;
    avatar.removeAttribute('data-fallback');

    // 关键：在设置 src 之前绑定监听，避免缓存命中导致错过 load。
    // 用 onload/onerror 覆盖旧监听，避免重复绑定积累。
    avatar.onload = () => {
      showImage();
    };
    avatar.onerror = () => {
      showFallback();
    };

    const src = String(p?.avatarSrc || 'assets/avatar.jpg');

    // 直接赋值 src，让浏览器加载；不要在这里调用 showFallback()，
    // 否则会清掉 src 导致图片无法加载。
    avatar.src = src;

    // 兜底：如果同步就已经 complete，则立即校正一次。
    if (avatar.complete) {
      if (avatar.naturalWidth > 0) showImage();
      else showFallback();
    }
  }
  if (name) name.textContent = p?.name || '';
  if (handle) handle.textContent = p?.handle || '';
  if (bio) bio.textContent = p?.bio || config?.site?.subtitle || '';

  if (hobbies) {
    hobbies.innerHTML = '';
    for (const h of (p?.hobbies || [])) {
      hobbies.appendChild(el('span', { class: 'pill', text: h }));
    }
  }
}

export function applyFooterHomeText(config) {
  const footerHome = document.getElementById('footerHome');
  if (!footerHome) return;
  // 优先显式字段；否则从 homeUrl 提取 host。
  const text =
    config?.site?.homeLabel ||
    (() => {
      try {
        const u = new URL(config?.site?.homeUrl || '', location.href);
        return u.host || '';
      } catch {
        return '';
      }
    })();

  footerHome.textContent = text || (config?.site?.homeUrl || '').replace(/^https?:\/\//, '') || 'Home';
}

export function renderSearchEngines(config) {
  const select = document.getElementById('engineSelect');
  if (!select) return;
  select.innerHTML = '';
  const engines = config?.search?.engines || [];
  for (const e of engines) {
    select.appendChild(el('option', { value: e.id, text: e.name }));
  }
  const def = config?.search?.defaultEngineId;
  if (def && engines.some((x) => x.id === def)) select.value = def;
}

export function renderAccountsTop(config, { max = 6 } = {}) {
  const root = document.getElementById('accountsTop');
  if (!root) return;
  root.innerHTML = '';

  const list = (config?.profiles || [])
    .slice()
    .sort((a, b) => (a.topRank ?? 999) - (b.topRank ?? 999));

  const top = list.filter((x) => x?.isTop).slice(0, max);
  for (const p of top) {
    const a = el('a', {
      class: 'tile external',
      href: p.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      'data-recent-name': p.name,
      'data-recent-url': p.url,
      'aria-label': `打开 ${p.name}`
    }, [
      el('div', { class: 'tile__left' }, [
        el('div', { class: 'tile__icon', text: p.icon || '🔗', 'aria-hidden': 'true' }),
        el('div', { class: 'tile__name', text: p.name || '' })
      ]),
      el('div', { class: 'tile__meta', text: p.note || '' })
    ]);

    if (typeof p.url === 'string' && p.url.startsWith('mailto:')) a.removeAttribute('rel');
    root.appendChild(a);
  }
}

export function renderBookmarksTop(bookmarks, { max = 8, onCategoryClick } = {}) {
  const root = document.getElementById('bookmarksTop');
  if (!root) return;
  root.innerHTML = '';
  
  // 显示分类而不是具体书签
  const categories = (bookmarks?.categories || []).slice(0, max);
  for (const cat of categories) {
    const tile = el('button', {
      class: 'tile tile--category',
      type: 'button',
      'data-category-id': cat.id,
      'aria-label': `打开分类 ${cat.title}`
    }, [
      el('div', { class: 'tile__left' }, [
        el('div', { class: 'tile__icon', text: cat.icon || '�', 'aria-hidden': 'true' }),
        el('div', { class: 'tile__name', text: cat.title || '' })
      ]),
      el('div', { class: 'tile__meta', text: `${(cat.items || []).length}` })
    ]);
    
    tile.addEventListener('click', () => {
      if (onCategoryClick) onCategoryClick(cat);
    });
    
    root.appendChild(tile);
  }
}

export function renderTodoTop(root, todos, { max = 5, onToggle } = {}) {
  if (!root) return;
  root.innerHTML = '';
  const undone = (todos || []).filter((x) => !x.done).slice(0, max);
  if (undone.length === 0) {
    root.appendChild(el('div', { class: 'muted', text: '暂无未完成事项。' }));
    return;
  }
  for (const t of undone) {
    root.appendChild(el('div', { class: 'todoRow' }, [
      el('div', { class: 'todoRow__text', text: t.text }),
      el('div', { class: 'todoRow__actions' }, [
        el('button', {
          class: 'btn btn--sm btn--ghost',
          type: 'button',
          'aria-label': '标记完成',
          onclick: () => onToggle && onToggle(t.id)
        }, '完成')
      ])
    ]));
  }
}

export function renderRecent(list) {
  const root = document.getElementById('recent');
  if (!root) return;
  root.innerHTML = '';
  if (!Array.isArray(list) || list.length === 0) {
    root.appendChild(el('div', { class: 'muted', text: '还没有记录。点击任意外链试试。' }));
    return;
  }

  for (const r of list) {
    const time = new Date(r.ts || Date.now());
    const label = time.toLocaleString(undefined, { hour12: false });
    root.appendChild(el('a', {
      href: r.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      class: 'external',
      'data-recent-name': r.name,
      'data-recent-url': r.url,
      'aria-label': `打开 ${r.name}`
    }, [
      el('div', { class: 'recent__name', text: r.name }),
      el('div', { class: 'recent__time', text: label })
    ]));
  }
}

export function setPanelVisible(panelId, visible) {
  const elx = document.getElementById(panelId);
  if (!elx) return;
  elx.hidden = !visible;
}

export function showError(message, detail) {
  setPanelVisible('errorPanel', true);
  const pre = document.getElementById('errorText');
  if (pre) pre.textContent = `${message}\n\n${detail || ''}`.trim();
}
