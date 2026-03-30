// SimilarCafe — UI / DOM rendering (chatbot redesign)

// ─── Chat helpers ─────────────────────────────────────────────────────────────

function getChatMessages() { return document.getElementById('chat-messages'); }
function getChatArea()     { return document.getElementById('chat-area'); }

function scrollToBottom() {
  const area = getChatArea();
  // Next frame so freshly inserted DOM is measured correctly
  requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
}

// Append a bot message bubble. Returns the wrapper element.
function appendBotMessage(text) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-bot';
  wrap.innerHTML = `
    <div class="bot-avatar">☕</div>
    <div class="bot-bubble">${escHtml(text)}</div>`;
  getChatMessages().appendChild(wrap);
  scrollToBottom();
  return wrap;
}

// Append a user message bubble.
function appendUserMessage(text) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-user';
  wrap.innerHTML = `<div class="user-bubble">${escHtml(text)}</div>`;
  getChatMessages().appendChild(wrap);
  scrollToBottom();
}

// Show animated typing indicator. Returns its DOM element.
function appendTypingIndicator() {
  const wrap = document.createElement('div');
  wrap.className = 'msg-typing';
  wrap.id = 'typing-indicator';
  wrap.innerHTML = `
    <div class="bot-avatar">☕</div>
    <div class="typing-bubble">
      <span class="dot"></span><span class="dot"></span><span class="dot"></span>
    </div>`;
  getChatMessages().appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function removeTypingIndicator() {
  document.getElementById('typing-indicator')?.remove();
}

// Append cafe result cards into the chat stream.
function appendCafeResults(cafes) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-cards';
  cafes.forEach(cafe => wrap.appendChild(createCafeCard(cafe, { mode: 'search' })));
  getChatMessages().appendChild(wrap);
  scrollToBottom();
}

// ─── Cafe card ────────────────────────────────────────────────────────────────

function createCafeCard(cafe, options = {}) {
  const { mode = 'search' } = options; // 'search' | 'picklist' | 'history'
  const inPicklist = isInPicklist(cafe.osmId);

  const card = document.createElement('div');
  card.className = 'cafe-card';
  card.dataset.osmId = cafe.osmId;

  // Status
  let statusHtml = '';
  if (cafe.openNow === true) {
    statusHtml = `<span class="status-dot status-dot--open"></span><span class="card-status card-status--open">Open</span>`;
  } else if (cafe.openNow === false) {
    statusHtml = `<span class="status-dot status-dot--closed"></span><span class="card-status card-status--closed">Closed</span>`;
  }

  const hoursHtml   = cafe.hoursToday ? `<span class="meta-sep"></span><span class="card-hours">${escHtml(cafe.hoursToday)}</span>` : '';
  const distHtml    = cafe.distText   ? `<span class="meta-sep"></span><span class="card-dist">${escHtml(cafe.distText)}</span>`    : '';

  // Action button(s)
  let footerHtml = '';
  if (mode === 'search') {
    const added = inPicklist;
    footerHtml = `<button class="btn-pick${added ? ' added' : ''}" data-osm-id="${cafe.osmId}"${added ? ' disabled' : ''}>${added ? 'Added ✓' : '+ Pick'}</button>`;
  } else if (mode === 'picklist') {
    footerHtml = `
      <button class="btn-remove" data-osm-id="${cafe.osmId}" aria-label="Remove">Remove</button>
      <button class="btn-going" data-osm-id="${cafe.osmId}">Going Here →</button>`;
  }

  card.innerHTML = `
    <div class="card-icon">${cafe.icon || '🍽'}</div>
    <div class="card-body">
      <span class="card-name">${escHtml(cafe.name)}</span>
      <span class="card-address">${escHtml(cafe.address)}</span>
      <div class="card-meta">${statusHtml}${hoursHtml}${distHtml}</div>
      ${footerHtml ? `<div class="card-footer">${footerHtml}</div>` : ''}
    </div>`;

  // Tap body → detail drawer (not buttons)
  card.addEventListener('click', e => {
    if (e.target.closest('button')) return;
    showDetailDrawer(cafe);
  });

  return card;
}

// ─── Location pill ────────────────────────────────────────────────────────────

function setPillText(text) {
  const label = document.getElementById('location-label');
  if (label) label.textContent = text;
}

// ─── Picklist badge ───────────────────────────────────────────────────────────

function updatePicklistBadge(count) {
  const badge = document.getElementById('picklist-badge');
  if (!badge) return;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

// ─── Sheets ───────────────────────────────────────────────────────────────────

function showSheet(sheetId) {
  document.getElementById('sheet-overlay').classList.add('visible');
  document.getElementById(sheetId).classList.add('open');
  document.body.classList.add('no-scroll');
}

function hideSheet(sheetId) {
  document.getElementById(sheetId).classList.remove('open');
  // Only remove overlay if no other sheet is open
  const anyOpen = document.querySelector('.sheet.open');
  if (!anyOpen) {
    document.getElementById('sheet-overlay').classList.remove('visible');
    document.body.classList.remove('no-scroll');
  }
}

function hideAllSheets() {
  document.querySelectorAll('.sheet.open').forEach(s => s.classList.remove('open'));
  document.getElementById('sheet-overlay').classList.remove('visible');
  document.body.classList.remove('no-scroll');
}

// ─── Picklist rendering ───────────────────────────────────────────────────────

function renderPicklist(picks) {
  const container = document.getElementById('picklist-container');
  container.innerHTML = '';
  if (!picks.length) {
    container.innerHTML = `<div class="empty-state">
      <span class="empty-icon">🔖</span>
      <p>No picks yet.</p>
      <p class="empty-sub">Search and tap + Pick on any cafe.</p>
    </div>`;
    return;
  }
  picks.forEach(cafe => container.appendChild(createCafeCard(cafe, { mode: 'picklist' })));
}

// ─── History rendering ────────────────────────────────────────────────────────

function renderHistory(visits) {
  const container = document.getElementById('history-container');
  container.innerHTML = '';
  if (!visits.length) {
    container.innerHTML = `<div class="empty-state">
      <span class="empty-icon">🕐</span>
      <p>No history yet.</p>
      <p class="empty-sub">Tap Going Here on a picked cafe to record a visit.</p>
    </div>`;
    return;
  }
  visits.forEach(visit => {
    const row = document.createElement('div');
    row.className = 'history-row';
    const date = new Date(visit.confirmedAt).toLocaleDateString([], {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    row.innerHTML = `
      <div class="history-icon">${visit.icon || '🍽'}</div>
      <div class="history-info">
        <div class="history-name">${escHtml(visit.name)}</div>
        <div class="history-addr">${escHtml(visit.address)}</div>
        <div class="history-date">Visited ${date}</div>
      </div>`;
    row.addEventListener('click', () => showDetailDrawer(visit));
    container.appendChild(row);
  });
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

let _drawerCafe = null;

function showDetailDrawer(cafe) {
  _drawerCafe = cafe;

  const inPicklist = isInPicklist(cafe.osmId);

  // Opening hours table
  let hoursHtml = '<p class="no-data">Hours not listed</p>';
  if (cafe.weekText) {
    const rows = cafe.weekText.map((row, i) => {
      const isToday = i === (cafe.todayIndex ?? -1);
      return `<tr class="${isToday ? 'today-row' : ''}">
        <td>${row.day.slice(0, 3)}</td>
        <td>${row.hours}</td>
      </tr>`;
    }).join('');
    hoursHtml = `<table class="hours-table"><tbody>${rows}</tbody></table>`;
  }

  const chips = (cafe.cuisine || []).map(c => `<span class="chip">${escHtml(c)}</span>`).join('');

  const phoneHtml   = cafe.phone   ? `<a class="drawer-link" href="tel:${cafe.phone}">📞 ${escHtml(cafe.phone)}</a>` : '';
  const websiteHtml = cafe.website ? `<a class="drawer-link" href="${escHtml(cafe.website)}" target="_blank" rel="noopener">🌐 Website</a>` : '';

  document.querySelector('.drawer-content').innerHTML = `
    <div class="drawer-hero">
      <div class="drawer-icon">${cafe.icon || '🍽'}</div>
      <div>
        <div class="drawer-name">${escHtml(cafe.name)}</div>
        ${cafe.distText ? `<div class="drawer-dist">${escHtml(cafe.distText)} away</div>` : ''}
      </div>
    </div>
    <div class="drawer-address">📍 ${escHtml(cafe.address)}</div>
    ${chips ? `<div class="drawer-chips">${chips}</div>` : ''}
    <div class="drawer-links">${phoneHtml}${websiteHtml}</div>
    <div class="drawer-section-title">Opening Hours</div>
    ${hoursHtml}`;

  const addBtn = document.querySelector('.drawer-add-btn');
  addBtn.textContent  = inPicklist ? 'Already in Picks' : '+ Add to Picks';
  addBtn.disabled     = inPicklist;

  document.getElementById('detail-drawer').classList.add('open');
  document.getElementById('drawer-overlay').classList.add('visible');
  document.body.classList.add('no-scroll');
}

function hideDetailDrawer() {
  document.getElementById('detail-drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('visible');
  document.body.classList.remove('no-scroll');
  _drawerCafe = null;
}

function getDrawerCafe() { return _drawerCafe; }

// ─── Directions ───────────────────────────────────────────────────────────────

let _map = null;
let _routeLayer = null;

function showDirectionsScreen(cafe, result, userLat, userLng, travelMode) {
  const screen = document.getElementById('screen-directions');
  screen.querySelector('.dir-dest-name').textContent = cafe.name;
  screen.querySelector('.dir-summary').textContent =
    `${result.totalDistText}  ·  ${result.totalDurText}`;

  // Sync mode buttons
  screen.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('mode-btn--active', btn.dataset.mode === travelMode);
  });

  screen.classList.add('active');

  // Map (slight delay lets the element render to full size before Leaflet measures it)
  setTimeout(() => {
    if (_map) { _map.remove(); _map = null; }
    _map = L.map('directions-map', { zoomControl: false, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(_map);

    // User marker
    L.circleMarker([userLat, userLng], {
      radius: 7, fillColor: '#007AFF', color: '#fff', weight: 2, fillOpacity: 1,
    }).addTo(_map);

    // Destination marker
    const icon = L.divIcon({
      html: `<div class="dest-marker"><span>${cafe.icon || '🍽'}</span></div>`,
      className: '', iconSize: [34, 34], iconAnchor: [17, 34],
    });
    L.marker([cafe.lat, cafe.lng], { icon }).addTo(_map);

    // Route
    if (_routeLayer) _map.removeLayer(_routeLayer);
    _routeLayer = L.geoJSON(result.geometry, {
      style: { color: '#1C1C1E', weight: 4, opacity: 0.8 },
    }).addTo(_map);
    _map.fitBounds(_routeLayer.getBounds(), { padding: [40, 40] });
  }, 80);

  // Steps
  const list = document.getElementById('steps-list');
  list.innerHTML = '';
  result.steps.forEach((step, i) => {
    if (!step.instruction && !step.distanceText) return;
    const row = document.createElement('div');
    row.className = 'step-row';
    row.innerHTML = `
      <span class="step-num">${i + 1}</span>
      <div class="step-body">
        <span class="step-instr">${escHtml(step.instruction || step.distanceText)}</span>
        <span class="step-dist">${step.distanceText}</span>
      </div>`;
    list.appendChild(row);
  });
}

function hideDirectionsScreen() {
  document.getElementById('screen-directions').classList.remove('active');
  if (_map) { _map.remove(); _map = null; }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(message, type = '') {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' toast--error' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
