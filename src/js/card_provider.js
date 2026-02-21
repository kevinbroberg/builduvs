import { ref, computed } from 'vue'
import Fuse from 'fuse.js'
import heroesclash from 'assets/heroesclash.json'
import rampage_dlc from 'assets/rampage_dlc.json'
import rampage from 'assets/rampage.json'
import provisional from 'assets/provs.json'
import ggrole from 'assets/gg-critrole.json'
import sjwtomha4 from 'assets/sjw-mha4.json'
import real_cards from 'assets/cards.json'

export const cards = [...ggrole, ...sjwtomha4,...heroesclash, ...rampage_dlc, ...provisional, ...rampage, ...real_cards]

// Ensure every card has a unique `asset` key (used by deck store and v-for keys).
// Newer data files omit `asset`, so synthesize one from extension_short + card_number_image.
for (const card of cards) {
  if (!card.asset) {
    card.asset = `${card.extension_short}/${card.card_number_image}`
  }
}

// --- Card schema: expected shape after preprocessing ---
// 'required' = must be present on every card
// 'type:X'   = required only when card.type === X
const CARD_SCHEMA = {
  // universal
  name:           { expect: 'string',   when: 'required' },
  type:           { expect: 'string',   when: 'required' },
  rarity:         { expect: 'string',   when: 'required' },
  resources:      { expect: 'array',    when: 'required' },
  formats:        { expect: 'array',    when: 'required' },
  text:           { expect: 'string',   when: 'required' },
  extension:      { expect: 'string',   when: 'required' },
  extension_short:{ expect: 'string' /*,   when: 'required' */},
  asset:          { expect: 'string',   when: 'required' },
  // character-only
  hand_size:      { expect: 'number',   when: 'type:character' },
  vitality:       { expect: 'number',   when: 'type:character' },
  // non-character combat stats
  control:        { expect: 'number',   when: 'type:attack,foundation,action,asset' },
  difficulty:     { expect: 'number',   when: 'type:attack,foundation,action,asset' },
  // attack-only
  speed:          { expect: 'number',   when: 'type:attack' },
  damage:         { expect: 'number',   when: 'type:attack' },
  attack_zone:    { expect: 'string',   when: 'type:attack' },
  // optional (no 'when' = never warn if absent, only warn on wrong type)
  block_modifier: { expect: 'number' },
  block_zone:     { expect: 'string' },
  keywords:       { expect: 'array' },
  limit:          { expect: 'number' },
}

if (import.meta.env.DEV) {
  const seen = new Set()
  for (const card of cards) {
    for (const [field, rule] of Object.entries(CARD_SCHEMA)) {
      const val = card[field]
      const present = val !== undefined && val !== null
      // check required / conditional presence
      if (rule.when) {
        let needed = false
        if (rule.when === 'required') {
          needed = true
        } else if (rule.when.startsWith('type:')) {
          needed = rule.when.slice(5).split(',').includes(card.type)
        }
        if (needed && !present) {
          const key = `${card.name}||${field}`
          if (!seen.has(key)) {
            seen.add(key)
            console.warn(`[card-schema] "${card.name}" (${card.extension_short}) missing required field "${field}"`)
          }
          continue
        }
      }
      // check type when present
      if (present) {
        const actual = Array.isArray(val) ? 'array' : typeof val
        if (actual !== rule.expect) {
          const key = `${card.name}||${field}||type`
          if (!seen.has(key)) {
            seen.add(key)
            console.warn(`[card-schema] "${card.name}" (${card.extension_short}) field "${field}" expected ${rule.expect}, got ${actual}`)
          }
        }
      }
    }
  }
}

export const symbolOptions = ["air", "all", "chaos", "death", "earth", "evil", "fire", "good", "infinity", "life", "order", "void", "water"]
export const formatOptions = ["My Hero Academia","MHA banned", "standard","standard banned","retro","retro banned","unreleased","alpha", "alpha legend"]

// Single source of truth for all filter fields.
// To add a new field, add one entry here — selections, URL serialization,
// query parsing, and filtering all derive from this config.
const FILTER_FIELDS = [
  { key: 'name',           type: 'fuzzy' },
  { key: 'text',           type: 'text', allowNone: true },
  { key: 'symbols',        type: 'symbol' },
  { key: 'symbols2',       type: 'symbol' },
  { key: 'symbols3',       type: 'symbol' },
  { key: 'extensions',     type: 'exact', cardField: 'extension' },
  { key: 'types',          type: 'exact', cardField: 'type' },
  { key: 'formats',        type: 'format', preserveOnReset: true },
  { key: 'difficulty',     type: 'exact' },
  { key: 'control',        type: 'exact' },
  { key: 'rarity',         type: 'exact' },
  { key: 'block_modifier', type: 'exact' },
  { key: 'block_zone',     type: 'exact' },
  { key: 'speed',          type: 'exact' },
  { key: 'damage',         type: 'exact' },
  { key: 'attack_zone',    type: 'exact' },
  { key: 'vitality',       type: 'exact' },
  { key: 'hand_size',      type: 'exact' },
  { key: 'keyword_count',  type: 'keywordCount' },
  { key: 'keyword_search', type: 'keywordSearch' },
  { key: 'keyword_picks',  type: 'keywordPick' },
]

const selections = ref({})
export function initializeSelections() {
  const prev = selections.value
  const init = {}
  for (const field of FILTER_FIELDS) {
    if (field.preserveOnReset) {
      init[field.key] = prev?.[field.key] || []
    } else if (field.type === 'text' || field.type === 'fuzzy') {
      init[field.key] = ''
    } else {
      init[field.key] = []
    }
  }
  selections.value = init
}
initializeSelections()

export function getFilterPath(skips = []) {
  const keys = FILTER_FIELDS
    .map(f => f.key)
    .filter(key => !skips?.includes(key))
  return keys
    .map(key => {
      const val = selections.value[key]
      return val && val.length > 0 ? encodeURI(key + "=" + JSON.stringify(val)) : ""
    })
    .filter(s => s.length > 0)
    .join("&")
}

// Builds the filter array once per selection change, not once per card.
// Inactive filters (empty selection) are skipped entirely.
const activeFilters = computed(() => {
  const filters = []
  for (const field of FILTER_FIELDS) {
    if (field.type === 'format') continue // handled as pre-filter by formatCards
    const sel = selections.value[field.key]
    if (!sel || sel.length === 0) continue
    const cardKey = field.cardField || field.key

    switch (field.type) {
      case 'fuzzy': {
        // Fuzzy mode handled by fuzzyScores in filteredCards.
        // Only add a filter here for regex opt-in (/ prefix).
        if (sel.startsWith('/')) {
          try {
            let pattern = sel.slice(1)
            let frontanchor = '.*'
            let backanchor = '.*'
            if (pattern.startsWith('^')) { frontanchor = '^'; pattern = pattern.slice(1) }
            if (pattern.endsWith('$')) { backanchor = '$'; pattern = pattern.slice(0, -1) }
            const regex = new RegExp(frontanchor + pattern + backanchor, 'i')
            filters.push(card => regex.test(card[cardKey]))
          } catch {
            console.error('Error with regex ' + sel)
            filters.push(() => false)
          }
        }
        break
      }
      case 'text': {
        if (field.allowNone && sel === "NONE") {
          filters.push(card => !card[cardKey])
        } else {
          try {
            let pattern = sel
            let frontanchor = '.*'
            let backanchor = '.*'
            if (pattern.startsWith('^')) { frontanchor = '^'; pattern = pattern.slice(1) }
            if (pattern.endsWith('$')) { backanchor = '$'; pattern = pattern.slice(0, -1) }
            const regex = new RegExp(frontanchor + pattern + backanchor, 'i')
            filters.push(card => regex.test(card[cardKey]))
          } catch {
            console.error('Error with regex ' + sel)
            filters.push(() => false)
          }
        }
        break
      }
      case 'exact':
        filters.push(card => sel.includes(card[cardKey]))
        break
      case 'symbol':
        filters.push(card =>
          card.resources.some(sym => sym === "infinity" || sel.includes(sym.toLowerCase()))
        )
        break
      case 'keywordCount':
        filters.push(card => sel.includes(card.keywords?.length || 0))
        break
      case 'keywordSearch': {
        const lowerChoices = sel.map(s => s.toLowerCase())
        filters.push(card => {
          const keys = card.keywords?.map(s => s.toLowerCase())
          return keys?.some(k => lowerChoices.some(choice => k.includes(choice)))
        })
        break
      }
      case 'keywordPick':
        filters.push(card =>
          card.keywords?.some(k => sel.some(choice => k.includes(choice)))
        )
        break
    }
  }
  return filters
})

// Exported for use in SimpleTypePicker
export function symbolFilter1(card) {
  const sel = selections.value.symbols
  if (sel && sel.length > 0) {
    return card.resources.some(sym => sym === "infinity" || sel.includes(sym.toLowerCase()))
  }
  return true
}

const formatCards = computed(() => {
  const sel = selections.value.formats
  if (sel && sel.length > 0) {
    return cards.filter(card => card.formats?.some(f => sel.includes(f)))
  }
  return cards
})

const fuseIndex = computed(() => {
  return new Fuse(formatCards.value, {
    keys: ['name'],
    threshold: 0.4,
    includeScore: true,
  })
})

// When fuzzy name search is active, returns a Map<card, score> for filtering + sorting.
// Returns null when inactive (no name query, or regex mode via / prefix).
const fuzzyScores = computed(() => {
  const sel = selections.value.name
  if (!sel || sel.length === 0 || sel.startsWith('/')) return null
  const results = fuseIndex.value.search(sel)
  const map = new Map()
  for (const r of results) map.set(r.item, r.score)
  return map
})

const filteredCards = computed(() => {
  const filters = activeFilters.value
  const scores = fuzzyScores.value

  let source = formatCards.value
  if (scores) source = source.filter(card => scores.has(card))

  let result = source.filter(card => {
    try {
      return filters.every(f => f(card))
    } catch (e) {
      console.error('Error on ' + card.name + ': ' + e.message)
      return false
    }
  })

  // Sort by fuzzy relevance when active (lower score = better match)
  if (scores) result.sort((a, b) => scores.get(a) - scores.get(b))

  return result
})

function stripQuotes(str) {
  if (str.charAt(0) === '"' && str.charAt(str.length - 1) === '"') {
    return str.slice(1, -1)
  }
  return str
}

export function handleQuery(query) {
  const queries = {}
  for (const field of FILTER_FIELDS) {
    if (field.type === 'text' || field.type === 'fuzzy') {
      queries[field.key] = query[field.key] ? stripQuotes(query[field.key]) : selections.value[field.key]
    } else {
      queries[field.key] = query[field.key] ? JSON.parse(query[field.key]) : selections.value[field.key]
    }
  }
  selections.value = queries
}

const mha_keywords = ['Ally',
'Breaker',
'Charge',
'Combo',
'EX',
'Flash',
'Fury',
'Kick',
'Powerful',
'Punch',
'Ranged',
'Slam',
'Stun',
'Throw',
'Unique',
'Weapon']

const universus_keywords = [
  "Ally",
  "Breaker",
  "Charge",
  "Combo",
  "Desperation",
  "EX",
  "Flash",
  "Fury",
  "Gauge",
  "Item",
  "Kick",
  "Multiple",
  "Only",
  "Powerful",
  "Punch",
  "Ranged",
  "Reversal",
  "Safe",
  "Slam",
  "Stance",
  "Stun",
  "Taunt",
  "Tech",
  "Terrain",
  "Throw",
  "Unique",
  "Weapon",
]

export function mhaOnlySelected() {
  return isMHA(selections.value.formats)
}

export function isMHA(formatList) {
  return formatList.length == 1 && formatList[0] == "My Hero Academia"
}

export function keywordList() {
  if (mhaOnlySelected()) {
    return mha_keywords
  } else {
    return universus_keywords
  }
}

export { selections, formatCards, filteredCards, mha_keywords, universus_keywords }
