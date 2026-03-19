import { clampList, newId, readJson, writeJson } from './storage.js';

const KEY = 'todos:v2';

/**
 * Todo item shape:
 * { id, text, createdAt, doneAt|null, done:boolean }
 */
export function loadTodos({ maxKeep = 200 } = {}) {
  const raw = readJson(KEY, []);
  const list = Array.isArray(raw) ? raw : [];
  // keep newest first
  const normalized = list
    .filter((x) => x && typeof x.text === 'string')
    .map((x) => ({
      id: x.id || newId(),
      text: String(x.text || '').trim(),
      createdAt: Number(x.createdAt || Date.now()),
      done: Boolean(x.done),
      doneAt: x.doneAt ? Number(x.doneAt) : null
    }))
    .filter((x) => x.text.length > 0)
    .sort((a, b) => b.createdAt - a.createdAt);

  return clampList(normalized, maxKeep);
}

export function saveTodos(list) {
  writeJson(KEY, Array.isArray(list) ? list : []);
}

export function addTodo(list, text) {
  const t = String(text || '').trim();
  if (!t) return list;
  const item = { id: newId(), text: t, createdAt: Date.now(), done: false, doneAt: null };
  return [item, ...(Array.isArray(list) ? list : [])];
}

export function toggleDone(list, id) {
  return (Array.isArray(list) ? list : []).map((x) => {
    if (x.id !== id) return x;
    const nextDone = !x.done;
    return { ...x, done: nextDone, doneAt: nextDone ? Date.now() : null };
  });
}

export function removeTodo(list, id) {
  return (Array.isArray(list) ? list : []).filter((x) => x.id !== id);
}

export function clearDone(list) {
  return (Array.isArray(list) ? list : []).filter((x) => !x.done);
}

export function splitTodos(list) {
  const all = Array.isArray(list) ? list : [];
  return {
    undone: all.filter((x) => !x.done).sort((a, b) => b.createdAt - a.createdAt),
    done: all.filter((x) => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0))
  };
}
