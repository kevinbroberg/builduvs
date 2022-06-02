import { ref, computed } from 'vue'
import rampage from 'assets/rampage.json'
import provisional from 'assets/provs.json'
import real_cards from 'assets/cards.json'
// TODO sooner than later: pull out legacy / retro 

export const cards = [...rampage, ...provisional, ...real_cards]
export const symbolOptions = ["air", "all", "chaos", "death", "earth", "evil", "fire", "good", "infinity", "life", "order", "void", "water"]
export const formatOptions = ["My Hero Academia","MHA banned", "standard","standard banned","retro","retro banned","unreleased","alpha", "alpha legend"]
/*
"block_modifier": 0,
"block_zone": "mid",
"hand_size": 6,
"vitality": 29,
"speed": 4,
"damage": 6,
"attack_zone": "high",
*/

const selections = ref({})
export function initializeSelections() {
    const prevFormat = selections.value?.formats || []
    selections.value = {
        name:  '', 
        text:  '', 
        symbols:   [], 
        symbols2:  [], 
        symbols3:  [],
        extensions:[], 
        types:     [], 
        formats:  prevFormat,
        difficulty:[],
        control:   [],
        rarity:    [],
        block_modifier: [],
        block_zone: [],
        speed: [],
        damage: [],
        attack_zone: [],
        vitality: [],
        hand_size: [],
        keyword_search:  [], 
        keyword_count: [],
        keyword_picks: []
    }
}
initializeSelections()

export function getFilterPath(skips = []) {
    let fields = [
        "name", // TODO t y p e s c r i p t
        "text",
        "symbols",
        "symbols2",
        "symbols3",
        "extensions",
        "types",
        "formats", 
        "difficulty", 
        "control",
        "rarity",
        "block_modifier",
        "block_zone",
        "speed",
        "damage",
        "attack_zone",
        "vitality",
        "hand_size",
        "keyword_count",
        "keyword_search",
        "keyword_picks",
      ]
    if (skips) {
      fields = fields.filter(f => !skips.includes(f))
    }
    let stringy = fields.map(field => selections.value[field] && selections.value[field].length > 0 
      ? encodeURI(field + "=" + JSON.stringify(selections.value[field])) 
      : "")
        
    console.log(stringy)
    return stringy.filter(val => val.length > 0).join("&")
    // let filterLink = location.origin + this.$route.path + '?' + queryStr
    // await navigator.clipboard.writeText(filterLink)
}

// TODO use more
// suitable for any field with exactly 1 value, like difficulty or attack_zone
function exactMatchFilter(field) {
  return (card) => {
    if (selections.value[field] && selections.value[field].length > 0) {
      return selections.value[field].includes(card[field])
    } else {
      return true
    }
  }
}

function nameFilter(card) {
    let val = selections.value.name
    if (val && val.length > 0) {
        let frontanchor = val.startsWith('^') ? '^' : '.*'
        let backanchor = val.endsWith('$') ? '$' : '.*'
        const regex = new RegExp(frontanchor + val + backanchor, 'i')
        return regex.test(card.name)
    } else {
        return true
    }
}
function symbolFilterGenerator(choices) {
  return (card) => {
    if (choices && choices.length > 0) {
      return card.resources.some(sym => sym == "infinity" || choices.includes(sym.toLowerCase()))
    } else {
      return true
    }
  }
}

// TODO bad practice / tech debt used for AttackHome
export function symbolFilter1(card) {
  return symbolFilterGenerator(selections.value.symbols)(card)
}

function originMatchFilter(card) {
  if (selections.value.extensions && selections.value.extensions.length > 0) {
    return selections.value.extensions.includes(card.extension)
  } else {
    return true
  }
}

function rarityFilter(card) {
  if (selections.value.rarity && selections.value.rarity.length > 0) {
    return selections.value.rarity.includes(card.rarity)
  } else {
    return true
  }
}
function typeMatchFilter(card) {
  if (selections.value.types && selections.value.types.length > 0) {
    return selections.value.types.includes(card.type)
  } else {
    return true
  }
}

function difficultyFilter(card) {
  if (selections.value.difficulty && selections.value.difficulty.length > 0) {
    return selections.value.difficulty.includes(card.difficulty)
  } else {
    return true
  }
}
function controlFilter(card) {
  if (selections.value.control && selections.value.control.length > 0) {
    return selections.value.control.includes(card.control)
  } else {
    return true
  }
}
function keywordCountFilter(card) {
  if (selections.value.keyword_count && selections.value.keyword_count.length > 0) {
    return selections.value.keyword_count.includes(card.keywords?.length || 0)
  } else {
    return true
  }
}
function formatMatchFilter(card) {
    if (selections.value.formats && selections.value.formats.length > 0) {
      return card.formats &&
        card.formats.some(format => selections.value.formats.includes(format))
    } else {
      return true
    }
}
function textFilter(card) {
  let choice = selections.value.text
  if (choice && choice.length > 0) {
    if (choice == "NONE") {
      return !card.text
    } else {
        let frontanchor = choice.startsWith('^') ? '^' : '.*'
        let backanchor = choice.endsWith('$') ? '$' : '.*'
        const regex = new RegExp(frontanchor + choice + backanchor, 'i')
        return regex.test(card.text)
    }
  } else {
    return true
  }
}

function keywordSearchFilter(card) {
  let choices = selections.value.keyword_search
  if (choices && choices.length > 0) {
    let tlc = s => s.toLowerCase() // i tried alternatives and rather dislike this, but it works
    choices = choices.map(tlc)
    let keys = card.keywords?.map(tlc)
    return keys?.some(key => choices.some(choice => key.includes(choice)))
  } else {
    return true
  }
}
function keywordPickFilter(card) {
  let choices = selections.value.keyword_picks // simplified, case sensitive version of keyword search because I fully control input options
  if (choices && choices.length > 0) {
    return card.keywords?.some(key => choices.some(choice => key.includes(choice)))
  } else {
    return true
  }
}

function allFiltersMatch(card) {
  let filters = [
                 nameFilter,
                 originMatchFilter,
                 difficultyFilter,
                 controlFilter,
                 symbolFilterGenerator(selections.value.symbols),
                 symbolFilterGenerator(selections.value.symbols2),
                 symbolFilterGenerator(selections.value.symbols3),
                 textFilter,
                 typeMatchFilter,
                 rarityFilter,
                 keywordCountFilter,
                 exactMatchFilter("block_modifier"),
                 exactMatchFilter("block_zone"),
                 exactMatchFilter("speed"),
                 exactMatchFilter("damage"),
                 exactMatchFilter("attack_zone"),
                 exactMatchFilter("vitality"),
                 exactMatchFilter("hand_size"),
                 keywordSearchFilter,
                 keywordPickFilter
                 ]
  return filters.every(f => {
    try {
        return f(card)
    } catch (e) {
        console.error('Error on ' + card.name + ': ' + e.message)
        return false
    }
  })
}

const formatCards = computed(() => cards.filter(formatMatchFilter))

const filteredCards = computed(() => formatCards.value.filter(card => allFiltersMatch(card)))

function stripQuotes(str) {
    if (str.charAt(0) === '"' && str.charAt(str.length -1) === '"') {
        return str.substr(1,str.length -2)
    }
    return str
}

export function handleQuery(query) {
    let queries = {
        name: query.name      ? stripQuotes(query.name)  : selections.value.name,
        text: query.text      ? stripQuotes(query.text)  : selections.value.text,
    }
    let listFields = ["symbols","symbols2","symbols3","extensions","types",
      "formats", "difficulty", "control", "rarity", "block_modifier", "block_zone", "speed",
      "damage", "attack_zone", "vitality","hand_size","keyword_count", "keyword_search", "keyword_picks"]
    listFields.forEach(field => queries[field] = query[field]  ? JSON.parse(query[field])  : selections.value[field])
    selections.value = queries
}

// {key for card in mha_cards for key in card.get('keywords') or []}
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