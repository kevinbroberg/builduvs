// Sorting and filtering for the tier maker's unranked tray. Display only: a card
// hidden by a filter is still unranked, just not shown.

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'ultra rare', 'secret rare', 'secret',
  'starter exclusive', 'promo']
const ZONE_ORDER = ['high', 'mid', 'low']

// `value` maps a card to something comparable; null/undefined always sorts last.
// 'set' is the order cardsFor() already produced (newest set, then collector number).
export const SORTS = [
  { key: 'set', label: 'Set order', value: null },
  { key: 'name', label: 'Name', value: c => c.name.toLowerCase() },
  { key: 'type', label: 'Type', value: c => c.type },
  { key: 'rarity', label: 'Rarity', value: c => {
    const i = RARITY_ORDER.indexOf(c.rarity)
    return i < 0 ? null : i
  } },
  { key: 'difficulty', label: 'Difficulty', value: c => c.difficulty },
  { key: 'control', label: 'Control', value: c => c.control },
  { key: 'speed', label: 'Speed', value: c => c.speed },
  { key: 'damage', label: 'Damage', value: c => c.damage },
  { key: 'block_modifier', label: 'Block modifier', value: c => c.block_modifier },
  { key: 'hand_size', label: 'Hand size', value: c => c.hand_size },
  { key: 'vitality', label: 'Vitality', value: c => c.vitality },
]

// Multi-select filters; a card passes one when it carries ANY of the picked values.
export const FILTERS = [
  { key: 'resources', label: 'Symbols', values: c => c.resources || [] },
  { key: 'attack_zone', label: 'Attack zone', values: c => (c.attack_zone ? [c.attack_zone] : []) },
  { key: 'block_zone', label: 'Block zone', values: c => (c.block_zone ? [c.block_zone] : []) },
  { key: 'rarity', label: 'Rarity', values: c => (c.rarity ? [c.rarity] : []) },
  { key: 'keywords', label: 'Keywords', values: c => c.keywords || [] },
]

export const defaultPoolView = () => ({
  sort: 'set',
  desc: false,
  search: '',
  picks: Object.fromEntries(FILTERS.map(f => [f.key, []])),
})

// Only what's worth offering for these cards: sorts whose value actually varies,
// filters with at least two distinct values.
export function poolViewOptions(cards) {
  const sorts = SORTS.filter(s =>
    !s.value || new Set(cards.map(s.value).filter(v => v != null)).size > 1)
  const filters = FILTERS.map(f => {
    const order = f.key === 'rarity' ? RARITY_ORDER : f.key.endsWith('_zone') ? ZONE_ORDER : null
    const options = [...new Set(cards.flatMap(f.values))].sort((a, b) =>
      order ? order.indexOf(a) - order.indexOf(b) : String(a).localeCompare(String(b)))
    return { ...f, options }
  }).filter(f => f.options.length > 1)
  return { sorts, filters }
}

export function activeFilterCount(view) {
  return (view.search.trim() ? 1 : 0)
    + Object.values(view.picks).filter(list => list.length).length
}

export function applyPoolView(cards, view) {
  const needle = view.search.trim().toLowerCase()
  let out = cards.filter(c => {
    if (needle && !c.name.toLowerCase().includes(needle)
      && !(c.text || '').toLowerCase().includes(needle)) return false
    for (const f of FILTERS) {
      const picked = view.picks[f.key]
      if (picked?.length && !f.values(c).some(v => picked.includes(v))) return false
    }
    return true
  })

  const sort = SORTS.find(s => s.key === view.sort)
  if (sort?.value) {
    const dir = view.desc ? -1 : 1
    out = out
      .map((c, i) => ({ c, i, v: sort.value(c) }))
      .sort((a, b) => {
        if (a.v == null || b.v == null) return (a.v == null) - (b.v == null) || a.i - b.i
        const cmp = a.v < b.v ? -1 : a.v > b.v ? 1 : 0
        return cmp * dir || a.i - b.i
      })
      .map(x => x.c)
  } else if (view.desc) {
    out = [...out].reverse()
  }
  return out
}
