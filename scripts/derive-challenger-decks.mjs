#!/usr/bin/env node
/**
 * Builds decklists for Challenger Series products UVS hasn't published a list
 * for yet, into src/assets/precon-decks-inferred.json.
 *
 * Usage: node scripts/derive-challenger-decks.mjs
 *
 * The quantities follow from rarity. The recent official Challenger/Clash
 * lists (src/assets/official-decks.json) ship each card at a fixed count:
 *
 *   character ×1 · common ×4 · uncommon ×3 · rare ×2 · ultra rare ×2
 *
 * It is a RECENT convention, not a universal one. Measured 2026-10-01 it holds
 * exactly on Attack on Titan, MHA08, Solo Leveling, both SF6 2025 decks and
 * both Tekken 8 clash decks, and breaks on the 2024-and-earlier Critical Role,
 * Godzilla, Trigun and Cowboy Bebop decks (Cowboy Bebop's rarities are all
 * "starter exclusive", so it can't apply at all).
 *
 * So each product names its precedent decks, and the script refuses to write
 * unless every one of them agrees with the rule AND each built deck lands on
 * the main-deck size the publisher announced. Either failing means the product
 * doesn't fit the mold, and it fails loudly here instead of producing a wrong
 * deck.
 *
 * Deck membership comes from collector numbers: a Challenger set prints each
 * deck as one run starting with its characters (sf62x: Bison/JP at 1–21,
 * Cammy/Juri at 22–42). Promo-rarity cards (sf62x/321–322) aren't in either
 * box and are left out.
 *
 * These are INFERRED, not published. PreconsPage labels them so, and drops an
 * inferred deck as soon as an official list for the same character exists —
 * once UVS posts theirs, `node scripts/fetch-official-decks.mjs` supersedes
 * this without anything here needing to be removed.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ASSETS = path.join(__dirname, '../src/assets')

const QTY = { common: 4, uncommon: 3, rare: 2, 'ultra rare': 2 }
const qtyOf = c => c.type === 'character' ? 1 : QTY[c.rarity]

// One entry per product. `decks` names each deck in collector-number order;
// `precedent` matches the official decks the rule must hold on; `mainSize` is
// the announced card count, characters excluded.
const PRODUCTS = [
  {
    file: 'sf6-2026.json',
    extensionShort: 'sf62x',
    product: 'Street Fighter 6 Challenger Series #2',
    releaseDate: '2026-10-02',
    source: 'https://uvsgames.com/news/street-fighter-6-returns-to-universus-with-two-new-challenger-series-decks/',
    decks: ['M. Bison & JP', 'Cammy & Juri'],
    precedent: /^Street Fighter 6 Challenger Series/,
    mainSize: 60, // "60 ready-to-play cards with two playable character options"
  },
]

const load = f => JSON.parse(fs.readFileSync(path.join(ASSETS, f), 'utf8'))

// -- 1. the rule must hold on each product's precedent decks -----------------

const byAsset = new Map()
for (const f of fs.readdirSync(ASSETS).filter(x => x.endsWith('.json'))) {
  let d
  try { d = load(f) } catch { continue }
  if (!Array.isArray(d)) continue
  for (const c of d) if (c?.asset && c.rarity) byAsset.set(c.asset, c)
}

const official = load('official-decks.json').entries
for (const p of PRODUCTS) {
  const decks = official.filter(d => p.precedent.test(d.name))
  if (!decks.length) throw new Error(`${p.product}: no official deck matches ${p.precedent}`)
  let checked = 0
  const breaks = []
  for (const deck of decks) for (const s of deck.sections) for (const e of s.cards) {
    const c = byAsset.get(e.asset)
    if (!c) { breaks.push(`${deck.name}: ${e.name} not in local card data`); continue }
    checked++
    if (qtyOf(c) !== e.count) breaks.push(`${deck.name}: ${e.name} (${c.rarity} ${c.type}) ×${e.count}, rule says ×${qtyOf(c)}`)
  }
  console.log(`${p.product}: rule holds on ${checked - breaks.length}/${checked} slots of ${decks.length} precedent decks`)
  if (breaks.length) {
    for (const b of breaks) console.error(`  ${b}`)
    process.exit(1)
  }
}

// -- 2. build the decks ---------------------------------------------------------

const entries = []
for (const p of PRODUCTS) {
  const cards = load(p.file)
    .filter(c => c.extension_short === p.extensionShort && c.rarity !== 'promo')
    .sort((a, b) => a.numero - b.numero)

  // Split into runs, a new one starting at each character after a non-character.
  const runs = []
  for (const c of cards) {
    const prev = runs.at(-1)?.at(-1)
    if (!prev || (c.type === 'character' && prev.type !== 'character')) runs.push([])
    runs.at(-1).push(c)
  }
  if (runs.length !== p.decks.length) {
    throw new Error(`${p.extensionShort}: found ${runs.length} decks, expected ${p.decks.length}`)
  }

  runs.forEach((run, i) => {
    const unknown = run.filter(c => !qtyOf(c))
    if (unknown.length) throw new Error(`no quantity rule for ${unknown.map(c => `${c.name} (${c.rarity})`).join(', ')}`)

    const slot = c => ({ name: c.name, asset: c.asset, count: qtyOf(c) })
    const chars = run.filter(c => c.type === 'character').map(slot)
    const main = run.filter(c => c.type !== 'character').map(slot)
    const total = [...chars, ...main].reduce((n, c) => n + c.count, 0)
    if (total - chars.length !== p.mainSize) {
      throw new Error(`${p.decks[i]}: rule gives ${total - chars.length} cards, ${p.product} announced ${p.mainSize}`)
    }

    entries.push({
      id: `inferred-${p.extensionShort}-${i + 1}`,
      name: `${p.product} - ${p.decks[i]}`,
      product: p.product,
      extensionShort: p.extensionShort,
      releaseDate: p.releaseDate,
      source: p.source,
      totalCards: total,
      character: chars[0].name,
      sections: [
        { name: 'character', cardCount: chars.length, cards: chars },
        { name: 'main', cardCount: main.reduce((n, c) => n + c.count, 0), cards: main },
        { name: 'sideboard', cardCount: 0, cards: [] },
      ],
    })
    console.log(`  ${entries.at(-1).name}: ${chars.length} characters + ${total - chars.length} cards`)
  })
}

fs.writeFileSync(path.join(ASSETS, 'precon-decks-inferred.json'), JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  basis: 'Quantities inferred from rarity (character ×1, common ×4, uncommon ×3, rare/ultra rare ×2), a rule every official Challenger/Clash list holds to. Not publisher data.',
  entries,
}, null, 2) + '\n')
console.log(`wrote ${entries.length} decks to src/assets/precon-decks-inferred.json`)
