// SimilarCafe — App logic (chatbot flow)

let userLat = null;
let userLng = null;
let lastResults = [];
let currentTravelMode = 'WALKING';

// ─── Boot ─────────────────────────────────────────────────────────────────────

function initApp() {
  restorePrefs();
  wireEvents();
  detectLocation();
}

function restorePrefs() {
  const prefs = getUserPrefs();
  if (prefs.radiusMetres) {
    const sel = document.getElementById('radius-select');
    if (sel) sel.value = prefs.radiusMetres;
  }
  const tog = document.getElementById('open-now-toggle');
  if (tog) tog.checked = prefs.openNowFilter !== false;

  if (prefs.lastLat && prefs.lastLng) {
    userLat = prefs.lastLat;
    userLng = prefs.lastLng;
    if (prefs.neighbourhood) setPillText(prefs.neighbourhood);
  }

  updatePicklistBadge(getPicklist().length);
}

// ─── Location ─────────────────────────────────────────────────────────────────

function detectLocation() {
  if (!navigator.geolocation) {
    showLocationFallback();
    appendBotMessage("I can't access your location. Enter your city below so I can find cafes near you.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async pos => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      saveUserPrefs({ lastLat: userLat, lastLng: userLng });

      let label = 'Your Location';
      try {
        label = await reverseGeocode(userLat, userLng);
        saveUserPrefs({ neighbourhood: label });
      } catch { /* use fallback label */ }

      setPillText(label);
      appendBotMessage(`I found you near ${label}. What are you craving today?`);
    },
    () => {
      showLocationFallback();
      appendBotMessage("I couldn't get your location. Enter your city below and I'll search from there.");
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function showLocationFallback() {
  document.getElementById('location-fallback').style.display = 'flex';
  setPillText('No location');
}

async function handleCitySearch() {
  const input = document.getElementById('city-input');
  const city = input?.value?.trim();
  if (!city) return;
  try {
    const coords = await forwardGeocode(city);
    userLat = coords.lat;
    userLng = coords.lng;
    saveUserPrefs({ lastLat: userLat, lastLng: userLng, neighbourhood: city });
    setPillText(city);
    document.getElementById('location-fallback').style.display = 'none';
    appendBotMessage(`Got it — searching near ${city}. What are you craving?`);
  } catch {
    showToast('City not found. Try a different name.', 'error');
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────

async function handleSearch() {
  const input   = document.getElementById('chat-input');
  const keyword = input?.value?.trim() || '';

  if (!keyword) { input?.focus(); return; }

  if (!userLat || !userLng) {
    appendBotMessage("I still need your location. Enter your city in the field above.");
    return;
  }

  appendUserMessage(keyword);
  input.value = '';

  const radiusM = parseInt(document.getElementById('radius-select')?.value || CONFIG.DEFAULT_RADIUS);
  const openNow = document.getElementById('open-now-toggle')?.checked ?? true;
  saveUserPrefs({ lastQuery: keyword, radiusMetres: radiusM, openNowFilter: openNow });

  appendTypingIndicator();

  try {
    let cafes = await searchCafes(userLat, userLng, keyword, radiusM, openNow);
    removeTypingIndicator();

    if (!cafes.length && keyword) {
      appendBotMessage(`No exact match for "${keyword}". Let me show you what's open nearby instead.`);
      appendTypingIndicator();
      cafes = await searchCafes(userLat, userLng, '', radiusM, openNow);
      removeTypingIndicator();
    }

    if (!cafes.length) {
      appendBotMessage("Nothing open nearby right now. Try widening the radius or come back later.");
      return;
    }

    lastResults = cafes;
    const plural = cafes.length !== 1 ? 's' : '';
    appendBotMessage(`Found ${cafes.length} place${plural} near you:`);
    appendCafeResults(cafes);
  } catch (err) {
    console.error('Search error:', err);
    removeTypingIndicator();
    appendBotMessage("Having trouble reaching the search service. Check your connection and try again.");
  }
}

// ─── Pick ─────────────────────────────────────────────────────────────────────

function handlePickCafe(osmId) {
  const cafe = lastResults.find(c => c.osmId === osmId)
    || getPicklist().find(c => c.osmId === osmId);
  if (!cafe) return;

  if (isInPicklist(osmId)) return;

  addToPicklist(cafe);
  updatePicklistBadge(getPicklist().length);

  // Update button in chat
  const btn = document.querySelector(`.btn-pick[data-osm-id="${osmId}"]`);
  if (btn) { btn.textContent = 'Added ✓'; btn.classList.add('added'); btn.disabled = true; }

  appendBotMessage(`Added ${cafe.name} to your picks! Tap 🔖 to see your list.`);
}

function handleAddFromDrawer() {
  const cafe = getDrawerCafe();
  if (!cafe) return;
  handlePickCafe(cafe.osmId);
  hideDetailDrawer();
}

// ─── Going Here ───────────────────────────────────────────────────────────────

async function handleGoingHere(osmId) {
  if (!userLat || !userLng) {
    showToast('Location unavailable.', 'error');
    return;
  }

  const cafe = getPicklist().find(c => c.osmId === osmId)
    || lastResults.find(c => c.osmId === osmId);
  if (!cafe) return;

  hideAllSheets();

  // Show directions screen with loading state
  const screen = document.getElementById('screen-directions');
  screen.querySelector('.dir-dest-name').textContent = cafe.name;
  screen.querySelector('.dir-summary').textContent = 'Getting route…';
  document.getElementById('steps-list').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-2);font-size:0.85rem;">Calculating…</div>';
  screen.classList.add('active');

  try {
    const result = await getDirections(userLat, userLng, cafe.lat, cafe.lng, currentTravelMode);
    showDirectionsScreen(cafe, result, userLat, userLng, currentTravelMode);
    addToHistory(cafe, currentTravelMode);
    updatePicklistBadge(getPicklist().length);
  } catch (err) {
    console.error('Directions error:', err);
    screen.querySelector('.dir-summary').textContent = 'Route unavailable';
    document.getElementById('steps-list').innerHTML =
      '<div style="padding:20px;text-align:center;color:var(--red);font-size:0.85rem;">Could not calculate route. Please try again.</div>';
  }
}

// ─── Remove from picklist ─────────────────────────────────────────────────────

function handleRemoveFromPicklist(osmId) {
  removeFromPicklist(osmId);
  updatePicklistBadge(getPicklist().length);
  renderPicklist(getPicklist());
}

// ─── History ─────────────────────────────────────────────────────────────────

function handleClearHistory() {
  if (!confirm('Clear all visit history?')) return;
  clearHistory();
  renderHistory([]);
}

// ─── Travel mode ──────────────────────────────────────────────────────────────

function setTravelMode(mode) {
  currentTravelMode = mode;
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('mode-btn--active', btn.dataset.mode === mode);
  });
}

// ─── Wire events ─────────────────────────────────────────────────────────────

function wireEvents() {

  // Send button & Enter key
  document.getElementById('send-btn').addEventListener('click', handleSearch);
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch();
  });

  // City fallback
  document.getElementById('city-search-btn').addEventListener('click', handleCitySearch);
  document.getElementById('city-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleCitySearch();
  });

  // Header buttons → open sheets
  document.getElementById('picklist-btn').addEventListener('click', () => {
    renderPicklist(getPicklist());
    showSheet('picklist-sheet');
  });
  document.getElementById('history-btn').addEventListener('click', () => {
    renderHistory(getHistory());
    showSheet('history-sheet');
  });

  // Sheet close buttons
  document.querySelectorAll('.sheet-close-btn').forEach(btn => {
    btn.addEventListener('click', () => hideSheet(btn.dataset.sheet));
  });

  // Sheet overlay tap → close all
  document.getElementById('sheet-overlay').addEventListener('click', hideAllSheets);

  // Picklist: delegated Going Here + Remove
  document.getElementById('picklist-container').addEventListener('click', e => {
    const goBtn  = e.target.closest('.btn-going');
    if (goBtn)  handleGoingHere(goBtn.dataset.osmId);

    const rmBtn  = e.target.closest('.btn-remove');
    if (rmBtn)  handleRemoveFromPicklist(rmBtn.dataset.osmId);
  });

  // Chat results: delegated Pick button
  document.getElementById('chat-messages').addEventListener('click', e => {
    const pickBtn = e.target.closest('.btn-pick');
    if (pickBtn && !pickBtn.disabled) handlePickCafe(pickBtn.dataset.osmId);
  });

  // Detail drawer
  document.getElementById('drawer-overlay').addEventListener('click', hideDetailDrawer);
  document.getElementById('drawer-close-btn').addEventListener('click', hideDetailDrawer);
  document.querySelector('.drawer-add-btn').addEventListener('click', handleAddFromDrawer);

  // Directions
  document.getElementById('dir-back-btn').addEventListener('click', hideDirectionsScreen);
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setTravelMode(btn.dataset.mode));
  });

  // History clear
  document.getElementById('clear-history-btn').addEventListener('click', handleClearHistory);

  // Android back button
  window.addEventListener('popstate', () => {
    if (document.getElementById('screen-directions').classList.contains('active')) {
      hideDirectionsScreen();
    } else {
      hideAllSheets();
      hideDetailDrawer();
    }
  });
}
