import { cards } from 'src/js/card_provider.js'

// "4 Name", "4x Name", "4) Name"
const leadingQty = /^(\d+)x?\)? (.*)$/
// "Name x4", "Namex4" (UVSUltra forum code altered by a browser extension)
const trailingQty = /^(.*?)\s*x(\d+)$/i
// "Sideboard", "[b]Side...", or a bare "Side" / "Side (3 cards)" section header
const sideboardHeader = /^(sideboard\b|\[b\]side|side\s*(\(.*\))?\s*:?$)/i
// Other section headers decklists carry ("Character:", "Main Deck", "Deck (60)").
// Skipped quietly. Every card goes to the main zone and the deck store routes
// the first character to the face slot, so these headers mean nothing to us.
const otherHeader = /^(characters?|main( ?deck)?|deck|maybe(board)?)\s*(\(.*\))?\s*:?$/i
const trailingDigit = /\d$/

// Names as other sites spell them: curly apostrophes (Hydra, carde.io: "Jin’s
// Glove"), accents ("Protégé"), en/em dashes, doubled spaces. Same folding as
// scripts/build-card-crosswalk.mjs.
export const normName = s => String(s).toLowerCase()
  .replace(/[‘’‚‛′`]/g, "'")
  .replace(/[“”„]/g, '"')
  .replace(/[–—]/g, '-')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

// normName → first card in pool order (the order the old linear scan returned).
let byName = null
function nameIndex() {
  if (!byName) {
    byName = new Map()
    for (const card of cards) {
      const k = normName(card.name)
      if (!byName.has(k)) byName.set(k, card)
    }
  }
  return byName
}

export function findCardByName(name) {
  const myName = normName(name)
  const index = nameIndex()
  // patch common problem with character names ("Akuma" -> "Akuma1")
  return index.get(myName) ?? (trailingDigit.test(myName) ? null : index.get(myName + 1)) ?? null
}

function parseLine(line) {
  const lead = line.match(leadingQty)
  if (lead) {
    const card = findCardByName(lead[2])
    return card ? { card, qty: Number.parseInt(lead[1]) } : { missed: lead[2] }
  }
  const trail = line.match(trailingQty)
  if (trail) {
    const card = findCardByName(trail[1])
    if (card) return { card, qty: Number.parseInt(trail[2]) }
  }
  // Bare card name, qty 1. Also catches names like "Alex1" that look like "Ale x1".
  const card = findCardByName(line)
  return card ? { card, qty: 1 } : { missed: line }
}

// Parse a text decklist into { main, side, missed }. main and side are lists of
// { card, qty }; missed is the lines that named no card we know, verbatim, so
// the dialogs can show them rather than dropping them silently.
export function parseDeckText(text) {
  const main = []
  const side = []
  const missed = []
  let target = main
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (sideboardHeader.test(line)) { target = side; continue }
    if (otherHeader.test(line)) continue
    const parsed = parseLine(line)
    if (parsed.card) target.push(parsed)
    else missed.push(line)
  }
  return { main, side, missed }
}
