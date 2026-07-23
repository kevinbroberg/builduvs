// Friendly display names for locals / regional events, shared by the app UI
// (src/pages/LocalsPage.vue) and the preview-manifest build script
// (scripts/gen-preview-manifest.mjs) so both stay in sync.

// LC format periods → friendly format name. `formatPeriod` is assigned per event
// by date in scripts/gen-locals.mjs.
export const LC_FORMATS = [
  { key: 'kaiju',    label: 'Reign of Kaiju' },
  { key: 'april',    label: 'April B&E' },
  { key: 'titan',    label: 'May B&E' },
  { key: 'mhafinal', label: 'Round 3' },
]

const labelByKey = new Map(LC_FORMATS.map(f => [f.key, f.label]))

// "Brownsburg, US" → "Brownsburg"; store names without a country ("Counterspell
// Games") pass through unchanged.
export const cityOf = location => (location || '').split(',')[0].trim()

// Friendly event name:
//   Regionals (round 0): "<City> Regional"
//   LCs (round 1–3):     "<Format> <City> Championship"
export function eventName(ev) {
  const city = cityOf(ev.location)
  if (ev.round === 0) return `${city} Regional`
  const fmt = labelByKey.get(ev.formatPeriod) ?? ''
  return [fmt, city, 'Championship'].filter(Boolean).join(' ')
}
