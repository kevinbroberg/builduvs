import { defineStore } from 'pinia'
import { cards, cardByAsset } from 'src/js/card_provider'

// Tier list state. Small enough to persist (cards are referenced by `asset`, never
// copied in), so a half-finished ranking survives a reload.
//
// An options store, like the rest: stores/index.js persists `toRaw(pinia.state)`,
// and a setup store's slice holds raw refs there, which JSON.stringify chokes on.
// Keys added later get their defaults on load (stores/index.js, BUVS-0005).

const FAIRY_TAIL = cards.find(c => c.extension_short === 'ft01')?.extension

// A tier's `rowColor` overrides the board-wide `rowColor` behind its cards; null
// (or absent, in older saves) means "use the board's".
export const DEFAULT_TIERS = () => [
  { id: 'high', label: ':attack_high: High', color: '#4caf50' },
  { id: 'mid', label: ':attack_mid: Mid', color: '#f0932b' },
  { id: 'low', label: ':attack_low: Low', color: '#7a5c45' },
]

// `rarities` empty means any rarity. Older saves lack it; treat absent as empty.
// `cards`, when set, is a hand-picked list of assets (usually from an imported file
// or a deck's "Rank" link) that replaces the type/set/rarity filters entirely; null
// means "use the filters". `extra` is cards quick-added on top of the filters (with
// a hand-picked list, quick adds just join `cards`).
export const DEFAULT_CRITERIA = () => ({
  types: ['character'],
  sets: FAIRY_TAIL ? [FAIRY_TAIL] : [],
  rarities: [],
  cards: null,
  extra: [],
})

export const POOL = 'pool'

// Set names newest first: `cards` (src/js/card_provider.js) is assembled that way.
export const ALL_SETS = [...new Set(cards.map(c => c.extension))]

// A set belongs to a format when at least half its cards carry the format's tag; a
// handful of legal reprints shouldn't drag a whole old promo set in.
function setsTagged(...tags) {
  const counts = new Map()
  for (const c of cards) {
    const e = counts.get(c.extension) ?? counts.set(c.extension, { n: 0, hit: 0 }).get(c.extension)
    e.n++
    if (tags.some(t => c.formats?.includes(t))) e.hit++
  }
  return ALL_SETS.filter(s => counts.get(s).hit * 2 >= counts.get(s).n)
}

// Quick picks for the setup page's set list.
//   Standard — tagged standard.
//   HeroToo  — My Hero Academia (set 1) and everything released since. Not tagged on
//              cards anywhere, so it's a release-order cut of ALL_SETS.
//   Retro    — tagged retro, plus everything in Standard: the newest sets' scrapes
//              carry no retro tag yet, and Retro includes all Standard-legal cards.
const HERO_TOO_FIRST = 'My Hero Academia'
export const FORMAT_SETS = {
  Standard: setsTagged('standard'),
  HeroToo: ALL_SETS.slice(0, ALL_SETS.indexOf(HERO_TOO_FIRST) + 1),
  Retro: setsTagged('retro', 'standard'),
}

// The cards a criteria object selects, one per name. `cards` runs newest set first,
// so a reprint resolves to its latest printing (within the chosen sets and rarities).
// Transform back sides ("285B") are skipped: they're the same card as their front
// for ranking purposes. A hand-picked list is taken as given, in its own order.
// Quick-added extras follow, unless the filters already caught that card.
export function cardsFor(criteria) {
  if (criteria.cards) {
    return [...new Set(criteria.cards)].map(a => cardByAsset.get(a)).filter(Boolean)
  }
  const types = new Set(criteria.types)
  const sets = new Set(criteria.sets)
  const rarities = new Set(criteria.rarities ?? [])
  const seen = new Set()
  const out = []
  for (const c of cards) {
    if (!types.has(c.type) || !sets.has(c.extension)) continue
    if (rarities.size && !rarities.has(c.rarity)) continue
    if (isBackSide(c)) continue
    if (seen.has(c.name)) continue
    seen.add(c.name)
    out.push(c)
  }
  for (const c of (criteria.extra ?? []).map(a => cardByAsset.get(a))) {
    if (!c || seen.has(c.name)) continue
    seen.add(c.name)
    out.push(c)
  }
  return out
}

export const isBackSide = (c) => /B$/i.test(String(c.numero ?? c.card_number ?? ''))

export const useTiersStore = defineStore('tiers', {
  // Setup vs. board is the route (/tiers vs. /tiers/rank), not state. Saves from
  // before that still carry a stale `phase`; nothing reads it.
  state: () => ({
    criteria: DEFAULT_CRITERIA(),
    tiers: DEFAULT_TIERS(),
    placements: {},                        // tierId -> [asset, ...] in display order
    title: '',
    rowColor: null,                        // background behind every row's cards; null = theme default
    viewMode: 'avatar',                    // 'avatar' | 'art' | 'card' (see TierFace)
  }),

  actions: {
    // Run on entering the ranking board. Placements for cards still in scope (and
    // tiers that still exist) carry over, so tweaking the criteria doesn't throw
    // away work.
    start() {
      const inScope = new Set(cardsFor(this.criteria).map(c => c.asset))
      const next = {}
      for (const t of this.tiers) {
        next[t.id] = (this.placements[t.id] || []).filter(a => inScope.has(a))
      }
      this.placements = next
    },

    // Bring a card into the list from outside the current selection (the tray's
    // quick add). It lands unranked.
    addCard(asset) {
      if (this.criteria.cards) {
        if (!this.criteria.cards.includes(asset)) this.criteria.cards.push(asset)
      } else {
        const extra = this.criteria.extra ??= []
        if (!extra.includes(asset)) extra.push(asset)
      }
    },

    // Move cards (in the given order) into a tier, or back to the pool, at `index`
    // of the destination as currently displayed; null appends.
    move(assets, to, index = null) {
      const moving = new Set(assets)
      // Moving cards that sit ahead of the drop point shifts it left once they go.
      if (to !== POOL && index != null) {
        index -= (this.placements[to] || []).slice(0, index).filter(a => moving.has(a)).length
      }
      for (const id of Object.keys(this.placements)) {
        this.placements[id] = this.placements[id].filter(a => !moving.has(a))
      }
      if (to === POOL) return
      const list = this.placements[to] ??= []
      list.splice(index == null ? list.length : Math.min(index, list.length), 0, ...assets)
    },

    // Add a tier at `index` (default: the bottom); returns its id.
    addTier(index = this.tiers.length) {
      const id = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
      this.tiers.splice(index, 0, { id, label: 'New tier', color: '#78909c', rowColor: null })
      this.placements[id] = []
      return id
    },

    // Send a tier's cards back to the pool, keeping the tier.
    clearTier(id) {
      this.placements[id] = []
    },

    // A removed tier's cards fall back to the pool.
    removeTier(id) {
      this.tiers = this.tiers.filter(t => t.id !== id)
      delete this.placements[id]
    },

    moveTier(id, delta) {
      const i = this.tiers.findIndex(t => t.id === id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= this.tiers.length) return
      const list = [...this.tiers]
      ;[list[i], list[j]] = [list[j], list[i]]
      this.tiers = list
    },

    resetTiers() {
      this.tiers = DEFAULT_TIERS()
      this.placements = {}
    },

    clearPlacements() {
      this.placements = Object.fromEntries(this.tiers.map(t => [t.id, []]))
    },

    // Replace the whole list with an imported one (see src/js/tier_file.js).
    load(state) {
      this.$patch(s => Object.assign(s, state))
      this.start()
    },
  },
})
