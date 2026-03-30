// SimilarCafe — LocalStorage persistence layer
// All keys prefixed sc_ to avoid collisions

const KEYS = {
  PICKLIST: 'sc_picklist',
  HISTORY:  'sc_history',
  PREFS:    'sc_user_prefs',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full — silently ignore
  }
}

// ─── Picklist ────────────────────────────────────────────────────────────────

function getPicklist() {
  return readJSON(KEYS.PICKLIST, []);
}

function addToPicklist(cafe) {
  let list = getPicklist();
  if (list.some(c => c.osmId === cafe.osmId)) return; // deduplicate
  list.unshift({ ...cafe, addedAt: new Date().toISOString() });
  if (list.length > CONFIG.MAX_PICKLIST) list = list.slice(0, CONFIG.MAX_PICKLIST);
  writeJSON(KEYS.PICKLIST, list);
}

function removeFromPicklist(osmId) {
  const list = getPicklist().filter(c => c.osmId !== osmId);
  writeJSON(KEYS.PICKLIST, list);
}

function isInPicklist(osmId) {
  return getPicklist().some(c => c.osmId === osmId);
}

// ─── History ─────────────────────────────────────────────────────────────────

function getHistory() {
  return readJSON(KEYS.HISTORY, []);
}

function addToHistory(cafe, travelMode) {
  let list = getHistory();
  list.unshift({
    ...cafe,
    confirmedAt: new Date().toISOString(),
    travelMode: travelMode || 'WALKING',
  });
  if (list.length > CONFIG.MAX_HISTORY) list = list.slice(0, CONFIG.MAX_HISTORY);
  writeJSON(KEYS.HISTORY, list);
}

function clearHistory() {
  writeJSON(KEYS.HISTORY, []);
}

// ─── User Prefs ──────────────────────────────────────────────────────────────

function getUserPrefs() {
  return readJSON(KEYS.PREFS, {
    lastLat: null,
    lastLng: null,
    lastQuery: '',
    radiusMetres: CONFIG.DEFAULT_RADIUS,
    openNowFilter: true,
    neighbourhood: '',
  });
}

function saveUserPrefs(partial) {
  const current = getUserPrefs();
  writeJSON(KEYS.PREFS, { ...current, ...partial });
}
