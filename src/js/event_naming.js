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
  { key: 'tekken8',  label: 'Tekken 8' },
]

const labelByKey = new Map(LC_FORMATS.map(f => [f.key, f.label]))

/**
 * Which deck-data shard an event's decklists live in.
 *
 * Deck rows are split into one file per TAB on /lists — each LC format period is
 * one tab holding many events, and each regional is a tab of its own. That makes
 * a shard exactly the working set for whatever the page is showing: the deck
 * filter's `scopeEvents` is already tab-scoped, so opening a tab fetches its
 * decks and nothing else.
 *
 * Defined here rather than in gen-locals.mjs because the build writes the shards
 * and the page reads them — two places that must agree, which is precisely the
 * kind of split that caused the card-id mess. One rule, imported by both.
 */
export const shardKeyOf = ev => (ev.round === 0 ? ev.id : ev.formatPeriod)

// "Brownsburg, US" → "Brownsburg"; store names without a country ("Counterspell
// Games") pass through unchanged.
export const cityOf = location => (location || '').split(',')[0].trim()

// Friendly event name:
//   Regionals (round 0): "<City> Regional"
//   LCs (round 1–4):     "<Format> <City> Championship"
export function eventName(ev) {
  const city = cityOf(ev.location)
  if (ev.round === 0) return `${city} Regional`
  const fmt = labelByKey.get(ev.formatPeriod) ?? ''
  return [fmt, city, 'Championship'].filter(Boolean).join(' ')
}
