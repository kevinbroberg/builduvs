import { cards } from 'src/js/card_provider.js'

// "4 Name", "4x Name", "4) Name"
const leadingQty = /^(\d+)x?\)? (.*)$/
// "Name x4", "Namex4" (UVSUltra forum code altered by a browser extension)
const trailingQty = /^(.*?)\s*x(\d+)$/i
// "Sideboard", "[b]Side...", or a bare "Side" / "Side (3 cards)" section header
const sideboardHeader = /^(sideboard\b|\[b\]side|side\s*(\(.*\))?$)/i
const trailingDigit = /\d$/

export function findCardByName(name) {
  const myName = name.toLowerCase()
  // patch common problem with character names ("Akuma" -> "Akuma1")
  const myAlias = trailingDigit.test(myName) ? '' : (myName + 1)
  for (const key in cards) {
    const tlc = cards[key].name.toLowerCase()
    if (tlc == myName || (myAlias && tlc == myAlias)) return cards[key]
  }
  return null
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

// Parse a text decklist into { main, side }, each a list of { card, qty }.
export function parseDeckText(text) {
  const main = []
  const side = []
  let target = main
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (sideboardHeader.test(line)) { target = side; continue }
    const parsed = parseLine(line)
    if (parsed.card) target.push(parsed)
    else console.log(`Missed ${parsed.missed.toLowerCase()}`)
  }
  return { main, side }
}
