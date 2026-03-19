import { incCounter, readJson } from './storage.js';

const CLICK_MAP_KEY = 'bookmark:clicks';

export function normalizeBookmarks(config) {
  const top = config?.bookmarks?.top || [];
  const categories = config?.bookmarks?.categories || [];

  const clicks = readJson(CLICK_MAP_KEY, {});
  const mergeClick = (item) => ({
    ...item,
    clickCount: typeof item?.clickCount === 'number' ? item.clickCount : (clicks?.[item?.url] || 0)
  });

  return {
    top: (Array.isArray(top) ? top : []).map(mergeClick),
    categories: (Array.isArray(categories) ? categories : []).map((c) => ({
      ...c,
      items: (Array.isArray(c.items) ? c.items : []).map(mergeClick)
    }))
  };
}

export function trackBookmarkClick(url) {
  if (!url) return;
  incCounter(CLICK_MAP_KEY, url);
}

export function flattenCategories(categories) {
  const list = [];
  for (const c of (Array.isArray(categories) ? categories : [])) {
    for (const it of (Array.isArray(c.items) ? c.items : [])) {
      list.push({ ...it, _categoryId: c.id, _categoryTitle: c.title, _categoryIcon: c.icon });
    }
  }
  return list;
}

export function searchBookmarks(categories, q) {
  const query = String(q || '').trim().toLowerCase();
  if (!query) return categories;

  return (Array.isArray(categories) ? categories : [])
    .map((c) => {
      const items = (Array.isArray(c.items) ? c.items : []).filter((it) => {
        const hay = `${it.name || ''} ${(it.tags || []).join(' ')}`.toLowerCase();
        return hay.includes(query);
      });
      return { ...c, items };
    })
    .filter((c) => (c.items || []).length > 0);
}
