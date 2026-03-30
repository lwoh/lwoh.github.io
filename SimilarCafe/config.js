// SimilarCafe — App-wide configuration
// 100% free, no API keys required

const CONFIG = {
  OVERPASS_URL: 'https://overpass-api.de/api/interpreter',
  NOMINATIM_URL: 'https://nominatim.openstreetmap.org',
  OSRM_BASE: 'https://router.project-osrm.org/route/v1',
  DEFAULT_RADIUS: 1000,       // metres
  MAX_PICKLIST: 20,
  MAX_HISTORY: 50,
  APP_NAME: 'SimilarCafe',
};

// Emoji icons mapped by OSM cuisine/amenity tags (longest match wins)
const CUISINE_ICONS = {
  coffee:       '☕',
  cafe:         '☕',
  tea:          '🍵',
  bubble_tea:   '🧋',
  bakery:       '🥐',
  pastry:       '🥐',
  sandwich:     '🥪',
  burger:       '🍔',
  pizza:        '🍕',
  pasta:        '🍝',
  italian:      '🍝',
  ramen:        '🍜',
  noodle:       '🍜',
  asian:        '🍜',
  japanese:     '🍣',
  sushi:        '🍣',
  korean:       '🍱',
  chinese:      '🥟',
  thai:         '🍛',
  indian:       '🍛',
  curry:        '🍛',
  mexican:      '🌮',
  tacos:        '🌮',
  seafood:      '🦞',
  steak:        '🥩',
  bbq:          '🍖',
  vegan:        '🥗',
  vegetarian:   '🥗',
  salad:        '🥗',
  ice_cream:    '🍦',
  dessert:      '🍰',
  cake:         '🎂',
  waffle:       '🧇',
  breakfast:    '🍳',
  brunch:       '🍳',
  bar:          '🍺',
  pub:          '🍺',
  juice:        '🥤',
  smoothie:     '🥤',
};

function getCuisineIcon(tags) {
  const cuisine = (tags.cuisine || '').toLowerCase();
  const amenity = (tags.amenity || '').toLowerCase();
  const name = (tags.name || '').toLowerCase();

  // Check cuisine tag first (can be semicolon-separated)
  const cuisines = cuisine.split(/[;,]/).map(s => s.trim());
  for (const c of cuisines) {
    for (const [key, icon] of Object.entries(CUISINE_ICONS)) {
      if (c.includes(key)) return icon;
    }
  }

  // Check name for clues
  for (const [key, icon] of Object.entries(CUISINE_ICONS)) {
    if (name.includes(key)) return icon;
  }

  // Fallback by amenity
  if (amenity === 'cafe') return '☕';
  if (amenity === 'bar') return '🍺';
  if (amenity === 'fast_food') return '🍟';
  return '🍽';
}
