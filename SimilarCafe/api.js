// SimilarCafe — API layer (Overpass, Nominatim, OSRM)
// All free, no API keys required

// ─── Haversine distance (metres) ─────────────────────────────────────────────

function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDistance(metres) {
  if (metres < 1000) return `${metres} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

// ─── Opening Hours Parsing (no external library) ────────────────────────────
// Handles common OSM formats: 24/7, Mo-Fr 09:00-18:00, Mo-Su 08:00-22:00, etc.

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
// JS getDay(): 0=Sun,1=Mon,...,6=Sat
// OSM abbreviations map to JS day index
const DAY_MAP = { Su:0, Mo:1, Tu:2, We:3, Th:4, Fr:5, Sa:6 };

function parseTimeToMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function formatMins(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2,'0')} ${ampm}`;
}

// Expand a day-range string like "Mo-Fr" into array of JS day indices
function expandDays(dayStr) {
  dayStr = dayStr.trim();
  if (!dayStr) return [];
  // Handle comma-separated groups within a rule's day part
  const parts = dayStr.split(',');
  const result = new Set();
  for (const part of parts) {
    const range = part.trim();
    if (DAY_MAP[range] !== undefined) {
      result.add(DAY_MAP[range]);
    } else if (range.includes('-')) {
      const [startAbb, endAbb] = range.split('-');
      const start = DAY_MAP[startAbb.trim()];
      const end = DAY_MAP[endAbb.trim()];
      if (start === undefined || end === undefined) continue;
      // Wrap-around support (e.g. Fr-Su)
      let d = start;
      while (true) {
        result.add(d);
        if (d === end) break;
        d = (d + 1) % 7;
        if (d === start) break; // safety
      }
    }
  }
  return [...result];
}

// Parse one rule like "Mo-Fr 09:00-18:00" or "24/7"
// Returns array of { days:[0..6], open:mins, close:mins } or null
function parseRule(rule) {
  rule = rule.trim();
  if (!rule) return null;
  if (rule === '24/7' || rule === 'open') {
    return { days: [0,1,2,3,4,5,6], open: 0, close: 1440 };
  }
  if (rule === 'closed' || rule === 'off') {
    return { days: [0,1,2,3,4,5,6], open: -1, close: -1, closed: true };
  }
  // Split on last time range pattern
  const m = rule.match(/^(.*?)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
  if (!m) return null;
  const dayPart = m[1].trim();
  const openMins = parseTimeToMins(m[2]);
  let closeMins = parseTimeToMins(m[3]);
  // Handle overnight (e.g. 22:00-02:00)
  if (closeMins <= openMins) closeMins += 1440;

  const days = expandDays(dayPart);
  if (!days.length) return null;
  return { days, open: openMins, close: closeMins };
}

function parseOpeningHours(ohString) {
  if (!ohString) return { isOpen: null, hoursToday: null, weekText: null };
  try {
    const now = new Date();
    const todayJS = now.getDay(); // 0=Sun
    const nowMins = now.getHours() * 60 + now.getMinutes();

    // Split into rules by semicolon
    const rules = ohString.split(';').map(r => r.trim()).filter(Boolean);
    const parsed = rules.map(parseRule).filter(Boolean);

    if (!parsed.length) return { isOpen: null, hoursToday: null, weekText: null };

    // Find today's rule(s)
    const todayRules = parsed.filter(r => r.days.includes(todayJS));
    let isOpen = false;
    let hoursToday = null;

    for (const r of todayRules) {
      if (r.closed) { isOpen = false; break; }
      if (nowMins >= r.open && nowMins < r.close) {
        isOpen = true;
        hoursToday = `Open until ${formatMins(r.close % 1440)}`;
        break;
      } else if (nowMins < r.open) {
        hoursToday = `Opens at ${formatMins(r.open)}`;
      }
    }

    if (todayRules.length && !isOpen && !hoursToday) {
      hoursToday = 'Closed today';
    }

    // Build week text
    const weekText = DAY_NAMES.map((day, jsDay) => {
      const dayRules = parsed.filter(r => r.days.includes(jsDay));
      if (!dayRules.length) return { day, hours: 'No data' };
      if (dayRules.some(r => r.closed)) return { day, hours: 'Closed' };
      const parts = dayRules.map(r => `${formatMins(r.open)}–${formatMins(r.close % 1440)}`);
      return { day, hours: parts.join(', ') };
    });

    return { isOpen, hoursToday, weekText, todayIndex: todayJS };
  } catch {
    return { isOpen: null, hoursToday: null, weekText: null };
  }
}

// ─── Nominatim Reverse Geocode ───────────────────────────────────────────────

async function reverseGeocode(lat, lng) {
  const url = `${CONFIG.NOMINATIM_URL}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SimilarCafe/1.0' },
  });
  if (!res.ok) throw new Error('Nominatim error');
  const data = await res.json();
  const a = data.address || {};
  return (
    a.neighbourhood ||
    a.suburb ||
    a.city_district ||
    a.quarter ||
    a.city ||
    a.town ||
    a.village ||
    'Your Location'
  );
}

// ─── Nominatim Forward Geocode (city name → coords) ──────────────────────────

async function forwardGeocode(cityName) {
  const url = `${CONFIG.NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SimilarCafe/1.0' },
  });
  if (!res.ok) throw new Error('Nominatim error');
  const data = await res.json();
  if (!data.length) throw new Error('City not found');
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

// ─── Overpass API — Nearby Cafe Search ───────────────────────────────────────

function buildOverpassQuery(lat, lng, radiusM, keyword) {
  const amenities = 'cafe|restaurant|bar|fast_food|food_court|ice_cream';

  let keywordFilter = '';
  if (keyword && keyword.trim()) {
    const kw = keyword.trim().replace(/[^a-zA-Z0-9 _-]/g, '');
    keywordFilter = `["name"~"${kw}",i]`;
  }

  return `
[out:json][timeout:25];
(
  node["amenity"~"${amenities}"]["name"]${keywordFilter}(around:${radiusM},${lat},${lng});
  way["amenity"~"${amenities}"]["name"]${keywordFilter}(around:${radiusM},${lat},${lng});
);
out center tags;
  `.trim();
}

function osmElementToCafe(el, userLat, userLng) {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;

  const streetParts = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean);
  const cityPart = tags['addr:city'] || tags['addr:suburb'] || '';
  const address = streetParts.length
    ? streetParts.join(' ') + (cityPart ? `, ${cityPart}` : '')
    : tags.vicinity || tags['addr:full'] || 'Address not listed';

  const cuisineRaw = tags.cuisine || '';
  const cuisine = cuisineRaw
    .split(/[;,]/)
    .map(s => s.trim().replace(/_/g, ' '))
    .filter(Boolean);

  const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null;
  const website = tags.website || tags['contact:website'] || tags['contact:facebook'] || null;
  const ohParsed = parseOpeningHours(tags.opening_hours);
  const distMetres = (lat != null && lng != null)
    ? calcDistance(userLat, userLng, lat, lng)
    : null;

  return {
    osmId: `${el.type}/${el.id}`,
    name: tags.name,
    address,
    lat,
    lng,
    distMetres,
    distText: distMetres != null ? formatDistance(distMetres) : null,
    cuisine,
    icon: getCuisineIcon(tags),
    amenity: tags.amenity,
    openNow: ohParsed.isOpen,
    hoursToday: ohParsed.hoursToday,
    weekText: ohParsed.weekText,
    todayIndex: ohParsed.todayIndex,
    phone,
    website,
    openingHoursRaw: tags.opening_hours || null,
    note: tags.note || tags.description || null,
    priceLevel: tags['price_range'] || null,
    addedAt: null,
  };
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function fetchOverpass(query) {
  let lastErr;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Overpass endpoint ${url} failed:`, err.message);
      lastErr = err;
    }
  }
  throw lastErr || new Error('All Overpass endpoints failed');
}

async function searchCafes(lat, lng, keyword, radiusM, openNowOnly) {
  const query = buildOverpassQuery(lat, lng, radiusM, keyword);
  const data = await fetchOverpass(query);

  let cafes = (data.elements || [])
    .filter(el => el.tags && el.tags.name)
    .map(el => osmElementToCafe(el, lat, lng));

  // Filter open-now (only when we have opening_hours data)
  if (openNowOnly) {
    cafes = cafes.filter(c => c.openNow !== false); // keep null (unknown) + true
  }

  // Sort by distance
  cafes.sort((a, b) => (a.distMetres ?? Infinity) - (b.distMetres ?? Infinity));

  return cafes;
}

// ─── OSRM Directions ─────────────────────────────────────────────────────────

async function getDirections(fromLat, fromLng, toLat, toLng, mode) {
  const profile = mode === 'DRIVING' ? 'driving' : 'foot';
  const url = `${CONFIG.OSRM_BASE}/${profile}/${fromLng},${fromLat};${toLng},${toLat}?steps=true&geometries=geojson&overview=full`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('OSRM error');
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes.length) throw new Error('No route found');

  const route = data.routes[0];
  const leg = route.legs[0];

  const steps = leg.steps.map(step => ({
    instruction: step.maneuver?.instruction || stripHtml(step.name || ''),
    type: step.maneuver?.type || 'straight',
    modifier: step.maneuver?.modifier || '',
    distanceM: Math.round(step.distance),
    distanceText: formatDistance(Math.round(step.distance)),
    durationSec: Math.round(step.duration),
  }));

  return {
    geometry: route.geometry,
    steps,
    totalDistM: Math.round(route.distance),
    totalDistText: formatDistance(Math.round(route.distance)),
    totalDurSec: Math.round(route.duration),
    totalDurText: formatDuration(Math.round(route.duration)),
  };
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} sec`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, '');
}
