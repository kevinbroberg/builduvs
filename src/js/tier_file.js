// Tier lists as shareable .json files. A file carries everything the board needs
// (criteria, tiers, placements, look) but not the session phase. Cards are
// referenced by `asset`, same as the persisted store; on import, assets this build
// doesn't know (and placements in tiers the file doesn't define) are dropped rather
// than failing the whole file.
//
// Hand-written files can be much smaller. Anywhere a card goes (`cards`,
// `criteria.cards`, `placements`), it may be an asset ("ft01/049"), a uvs_id
// ("ft01-049") or a card name (newest printing wins). Every key but `kind` is
// optional, so a seed for a custom ranking can be just:
//
//   { "kind": "builduvs-tier-list", "title": "Quests", "cards": ["Card A", "Card B"] }
//
// or even a bare array of cards. A card list replaces the type/set/rarity filters;
// whatever isn't placed in a tier starts out unranked.
import { cards, cardByAsset, cardByUvsId } from 'src/js/card_provider'
import { DEFAULT_CRITERIA, DEFAULT_TIERS } from 'src/stores/tiers'

const KIND = 'builduvs-tier-list'
const VERSION = 1

export function toTierFile(state) {
  return {
    kind: KIND,
    version: VERSION,
    title: state.title,
    criteria: state.criteria,
    tiers: state.tiers,
    placements: state.placements,
    rowColor: state.rowColor,
    viewMode: state.viewMode,
  }
}

const strings = (v) => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : [])
const color = (v) => (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v) ? v : null)

// Names compare loosely: case, curly quotes and runs of spaces don't matter.
const normName = (s) => s.toLowerCase().replace(/[‘’ʼ`]/g, "'").replace(/[“”]/g, '"')
  .replace(/\s+/g, ' ').trim()
let byName = null
function cardByName(name) {
  if (!byName) {
    byName = new Map()
    // `cards` runs newest set first, so the first printing seen is the latest.
    for (const c of cards) {
      const key = normName(c.name)
      if (!byName.has(key)) byName.set(key, c)
    }
  }
  return byName.get(normName(name))
}

const resolveCard = (ref) =>
  cardByAsset.get(ref) ?? cardByUvsId.get(ref.trim().toLowerCase()) ?? cardByName(ref)

// Parse and sanitize a file's text into store state, plus the card references it
// couldn't match. Throws an Error with a user-facing message when the file isn't a
// tier list at all.
export function fromTierFile(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON.")
  }
  if (Array.isArray(data)) data = { kind: KIND, cards: data }
  if (data?.kind !== KIND) {
    throw new Error("That file isn't a BuildUVS tier list.")
  }
  if (data.version > VERSION) {
    throw new Error('That tier list was saved by a newer version of the site. Reload and try again.')
  }

  const unresolved = []
  const toAssets = (refs) => refs.flatMap(ref => {
    const card = resolveCard(ref)
    if (!card) unresolved.push(ref)
    return card ? [card.asset] : []
  })

  const seenIds = new Set()
  const tiers = Array.isArray(data.tiers)
    ? data.tiers
      .filter(t => t && typeof t.id === 'string' && !seenIds.has(t.id) && seenIds.add(t.id))
      .map(t => ({
        id: t.id,
        label: typeof t.label === 'string' ? t.label : '',
        color: color(t.color) ?? '#78909c',
        rowColor: color(t.rowColor),
      }))
    : DEFAULT_TIERS()
  if (!tiers.length) throw new Error('That tier list has no tiers.')

  // A card sits in at most one tier; the first one listed wins.
  const placed = new Set()
  const placements = {}
  for (const t of tiers) {
    placements[t.id] = toAssets(strings(data.placements?.[t.id]))
      .filter(a => !placed.has(a) && placed.add(a))
  }

  // A card list means exactly those cards (plus anything placed), filters aside.
  const listed = data.cards ?? data.criteria?.cards
  let pick = null
  if (Array.isArray(listed)) {
    pick = [...new Set([...toAssets(strings(listed)), ...placed])]
    if (!pick.length) throw new Error("None of that file's cards matched a card on this site.")
  }

  const defaults = DEFAULT_CRITERIA()
  const criteria = {
    types: data.criteria?.types ? strings(data.criteria.types) : defaults.types,
    sets: data.criteria?.sets ? strings(data.criteria.sets) : defaults.sets,
    rarities: strings(data.criteria?.rarities),
    cards: pick,
  }

  return {
    state: {
      title: typeof data.title === 'string' ? data.title : '',
      criteria,
      tiers,
      placements,
      rowColor: color(data.rowColor),
      viewMode: ['avatar', 'art', 'card'].includes(data.viewMode) ? data.viewMode : 'avatar',
    },
    unresolved: [...new Set(unresolved)],
  }
}

export function tierFileName(title) {
  const slug = (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${slug || 'tier-list'}.json`
}

export function downloadTierFile(state) {
  const blob = new Blob([JSON.stringify(toTierFile(state), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = tierFileName(state.title)
  a.click()
  URL.revokeObjectURL(url)
}
