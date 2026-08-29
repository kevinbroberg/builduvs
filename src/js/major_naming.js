// Display metadata for historical major events, shared by the majors page
// (src/pages/MajorsPage.vue) and any build script that needs the same labels.
//
// Tier and season are assigned per event by scripts/fetch-majors.mjs and carried
// through scripts/gen-majors.mjs into majors-index.json.

// Ordered most prestigious first. `rank` drives sorting within a season so a
// season reads Worlds → LCQ → Nationals → Majors → Regionals rather than
// alphabetically. `color` maps to a Quasar palette name for the tier badge.
export const TIERS = [
  { key: 'worlds',        label: 'World Championship', short: 'Worlds',    rank: 0, color: 'amber-8' },
  { key: 'worldsLCQ',     label: 'Worlds LCQ',         short: 'LCQ',       rank: 1, color: 'orange-8' },
  { key: 'nationals',     label: 'Nationals',          short: 'Nationals', rank: 2, color: 'purple-6' },
  { key: 'majorRegional', label: 'Major Regional',     short: 'Major',     rank: 3, color: 'blue-7' },
  { key: 'regional',      label: 'Regional',           short: 'Regional',  rank: 4, color: 'teal-7' },
  { key: 'webcamMajor',   label: 'Webcam Major',       short: 'Webcam',    rank: 5, color: 'blue-grey-6' },
]

const tierByKey = new Map(TIERS.map(t => [t.key, t]))

export const tierInfo  = key => tierByKey.get(key) ?? { key, label: key, short: key, rank: 99, color: 'grey-7' }
export const tierLabel = key => tierInfo(key).label
export const tierRank  = key => tierInfo(key).rank

// Seasons run spring-to-spring and close at the World Championship: FY2024 opens
// with the Season 1 majors in April 2024 and ends at the 2024 World Championship
// in Feb 2025; FY2025 opens at Denver in March 2025 and ends at the 2025 World
// Championship in Feb 2026.
export const seasonLabel = season => season?.startsWith('FY')
  ? `${season.slice(2)} Season`
  : (season || 'Unknown')

// "Grapevine, US" → "Grapevine"; "Online" passes through unchanged.
export const cityOf = location => (location || '').split(',')[0].trim()

// Sort events within a season: tier first, then chronologically.
export function compareEvents(a, b) {
  const r = tierRank(a.tier) - tierRank(b.tier)
  return r !== 0 ? r : a.date.localeCompare(b.date)
}
