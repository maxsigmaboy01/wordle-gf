export function readStorage(key) {
  try {
    const raw = window.DailyPuzzleNative ? window.DailyPuzzleNative.get(key) : localStorage.getItem(key);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStorage(key, value) {
  try {
    const raw = JSON.stringify(value);
    if (window.DailyPuzzleNative) window.DailyPuzzleNative.set(key, raw);
    else localStorage.setItem(key, raw);
  } catch {}
}

export function roundIdentifier() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
