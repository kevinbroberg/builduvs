/**
 * Merges cardeio-ids.json into the main card JSON files.
 * Adds `cardeio_id` field to each matched card in-place.
 * Matching normalizes curly apostrophes/double-quotes → straight, strips diacritics, and lowercases both sides.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const assetsDir = resolve(__dirname, '../src/assets')

function normalize(name) {
  return name
    .replace(/[\u2018\u2019\u02BC]/g, "'")   // curly apostrophes → straight
    .replace(/[\u201C\u201D]/g, '"')          // curly double quotes → straight
    .replace(/^"+|"+$/g, '')                  // strip surrounding double quotes
    .normalize('NFD').replace(/\p{Mn}/gu, '') // strip diacritics (ë → e, é → e, etc.)
    .trim()
    .toLowerCase()
}

// Build lookup: normalized name → { id, slug }
// Also build prefix index: everything before the first ", " or " //" → [{ id, slug }]
// Used as a fallback so "Jacob Johnson" matches "Jacob Johnson, 2019 UK National Champion"
// Only fires if exactly one carde.io card shares that prefix (avoids wrong guesses).
const cardeioIds = JSON.parse(readFileSync(resolve(assetsDir, 'cardeio-ids.json'), 'utf8'))
const idx = {}
const prefixIdx = {} // prefix → array of hits
for (const [key, val] of Object.entries(cardeioIds)) {
  const nk = normalize(key)
  const hit = { id: val.id, slug: val.slug }
  idx[nk] = hit
  // Index two prefix types for fallback matching:
  //   1. Before " //" — catches "Reiner Braun, Warrior" → "reiner braun, warrior // reiner, armored titan advancing"
  //   2. Before first ", " — catches "Jacob Johnson" → "jacob johnson, 2019 uk national champion"
  const addPrefix = (prefix) => {
    if (!prefix || prefix === nk) return
    if (!prefixIdx[prefix]) prefixIdx[prefix] = []
    prefixIdx[prefix].push(hit)
  }
  const flipSep = nk.indexOf(' //')
  if (flipSep > 0) addPrefix(nk.slice(0, flipSep))
  const commaSep = nk.indexOf(', ')
  if (commaSep > 0) addPrefix(nk.slice(0, commaSep))
}

function lookup(key) {
  // Tier 1: exact match
  if (idx[key]) return idx[key]
  // Tier 2: append (i)
  if (idx[key + ' (i)']) return idx[key + ' (i)']
  // Tier 3: unambiguous prefix match (e.g. "Jacob Johnson" → "Jacob Johnson, 2019 UK Champion")
  const prefixHits = prefixIdx[key]
  if (prefixHits?.length === 1) return prefixHits[0]
  return null
}

const cardFiles = readdirSync(assetsDir).filter(
  f => f.endsWith('.json') && f !== 'cardeio-ids.json'
)

let totalMatched = 0
let totalCards = 0

for (const file of cardFiles) {
  const filePath = resolve(assetsDir, file)
  const raw = JSON.parse(readFileSync(filePath, 'utf8'))
  const isArray = Array.isArray(raw)
  const cards = isArray ? raw : Object.values(raw)

  let fileMatched = 0
  for (const card of cards) {
    if (!card.name) continue
    totalCards++
    const key = normalize(card.name)
    const hit = lookup(key)
    if (hit) {
      card.cardeio_id = hit.id
      card.cardeio_slug = hit.slug
      fileMatched++
      totalMatched++
    } else {
      // Remove stale fields if name no longer matches
      delete card.cardeio_id
      delete card.cardeio_slug
    }
  }

  writeFileSync(filePath, JSON.stringify(raw, null, 2) + '\n')
  console.log(`${file}: ${fileMatched} matched`)
}

console.log(`\nDone. ${totalMatched}/${totalCards} cards have cardeio_id.`)
