const NS = 'startpage:';

export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  localStorage.setItem(NS + key, JSON.stringify(value));
}

export function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function remove(key) {
  localStorage.removeItem(NS + key);
}

export function clampList(list, max) {
  if (!Array.isArray(list)) return [];
  if (typeof max !== 'number' || max <= 0) return [];
  return list.slice(0, max);
}

export function upsertRecent(recentList, entry, max) {
  const now = Date.now();
  const normalized = {
    name: entry?.name || entry?.url || 'link',
    url: entry?.url || '#',
    ts: now
  };

  const next = [normalized, ...(Array.isArray(recentList) ? recentList : [])]
    .filter((x) => x && typeof x.url === 'string')
    .reduce((acc, cur) => {
      if (!acc.some((x) => x.url === cur.url)) acc.push(cur);
      return acc;
    }, []);

  return clampList(next, max);
}

export function newId() {
  // good enough for localStorage ids
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function incCounter(mapKey, itemKey) {
  const data = readJson(mapKey, {});
  const next = { ...(data || {}) };
  next[itemKey] = safeNumber(next[itemKey], 0) + 1;
  writeJson(mapKey, next);
  return next[itemKey];
}
