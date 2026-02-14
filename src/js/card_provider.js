import { ref, computed } from 'vue'
import heroesclash from 'assets/heroesclash.json'
import rampage_dlc from 'assets/rampage_dlc.json'
import rampage from 'assets/rampage.json'
import provisional from 'assets/provs.json'
import real_cards from 'assets/cards.json'

export const cards = [...heroesclash, ...rampage_dlc, ...provisional, ...rampage, ...real_cards]
export const symbolOptions = ["air", "all", "chaos", "death", "earth", "evil", "fire", "good", "infinity", "life", "order", "void", "water"]
export const formatOptions = ["My Hero Academia","MHA banned", "standard","standard banned","retro","retro banned","unreleased","alpha", "alpha legend"]

// Single source of truth for all filter fields.
// To add a new field, add one entry here — selections, URL serialization,
// query parsing, and filtering all derive from this config.
const FILTER_FIELDS = [
  { key: 'name',           type: 'text' },
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
    } else if (field.type === 'text') {
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

const filteredCards = computed(() => {
  const filters = activeFilters.value
  return formatCards.value.filter(card => {
    try {
      return filters.every(f => f(card))
    } catch (e) {
      console.error('Error on ' + card.name + ': ' + e.message)
      return false
    }
  })
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
    if (field.type === 'text') {
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
