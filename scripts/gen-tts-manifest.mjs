/**
 * Generates netlify/edge-functions/lib/tts-data.js — every /lists and /majors
 * decklist, already resolved to cards, for the edge function that serves
 * Tabletop Simulator JSON at:
 *
 *   /lists/:event/:id/tts.json
 *   /majors/:event/:id/tts.json
 *
 * Resolution runs here, at generation time, through the same resolver the
 * pages use (src/js/card_resolver.js), so the endpoint returns exactly what the
 * page's TTS download button does. The edge function then needs neither the
 * card database nor the deck-data shards — just this file.
 *
 * Re-run this whenever the decklists or the card data change — i.e. after
 * gen-locals.mjs / gen-majors.mjs, alongside gen-preview-manifest.mjs:
 *
 *   node scripts/gen-tts-manifest.mjs
 *
 * The output is committed so no build-step wiring is required.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { uvsId } from '../src/js/card_id.js'
import { createCardResolverFrom } from '../src/js/card_resolver.js'
import { shardKeyOf } from '../src/js/event_naming.js'
import { ttsCardFields } from '../src/js/tts_export.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assets = path.join(root, 'src', 'assets')
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

// ── Card pool — mirrors src/js/card_provider.js (file order, asset, uvs_id) ──

const CARD_FILES = [
  'tekken8.json', 'mha09.json', 'kaiju.json', 'teamhero.json', 'gg-critrole.json',
  'sjw-mha4.json', 'heroesclash.json', 'rampage_dlc.json', 'provs.json',
  'rampage.json', 'cards.json',
]

const cards = CARD_FILES.flatMap((f) => readJson(path.join(assets, f)))
for (const c of cards) {
  if (!c.asset) c.asset = `${c.extension_short}/${c.card_number_image}`
  c.uvs_id = uvsId(c)
}
const cardByUvsId = new Map(cards.filter((c) => c.uvs_id).map((c) => [c.uvs_id, c]))
const cardeioIds = readJson(path.join(assets, 'cardeio-ids.json'))

// ── Shared card table ────────────────────────────────────────────────────────
// Decks reference cards by index into one table, deduplicated across both
// sections, so a staple played in a thousand decks is stored once.

const table = []
const indexOfCard = new Map() // asset → table index

function cardIndex(card) {
  if (!indexOfCard.has(card.asset)) {
    indexOfCard.set(card.asset, table.length)
    table.push(ttsCardFields(card))
  }
  return indexOfCard.get(card.asset)
}

// ── Decks ────────────────────────────────────────────────────────────────────

/**
 * @param {object}   opts
 * @param {string}   opts.indexFile      locals-index.json / majors-index.json
 * @param {string}   opts.shardDir       public/deck-data/<section>
 * @param {Function} opts.shardOf        event → shard key
 * @param {boolean}  opts.standardOnly   the pool the page resolves against
 * @param {Function} opts.deckName       (standing, event) → TTS deck name, as the page names it
 */
function buildSection({ indexFile, shardDir, shardOf, standardOnly, deckName }) {
  const { resolveCard } = createCardResolverFrom({ cards, cardByUvsId, cardeioIds, standardOnly })
  const index = readJson(path.join(assets, indexFile))
  const shards = new Map()
  const loadShard = (key) => {
    if (!shards.has(key)) {
      const p = path.join(root, 'public', 'deck-data', shardDir, `${key}.json`)
      shards.set(key, fs.existsSync(p) ? readJson(p) : { cards: {} })
    }
    return shards.get(key)
  }

  const decks = {}
  const unresolved = new Set()
  // Mirrors resolveCard → generateTTSJson: an unresolved card or one with no
  // image is dropped from the pile, exactly as the download button drops it.
  const resolveRow = (row) => {
    const card = resolveCard(row)
    if (card.type === 'unknown' || !ttsCardFields(card)) {
      unresolved.add(row.name)
      return null
    }
    return [cardIndex(card), row.qty]
  }

  for (const ev of index.events) {
    const shard = loadShard(shardOf(ev))
    for (const s of index.standings[ev.id] || []) {
      if (!s.hasDeck) continue
      const rows = shard.cards[s.id]
      if (!rows?.length) continue
      const bySection = { character: [], main: [], sideboard: [] }
      for (const r of rows) bySection[r.section]?.push(r)

      const face = bySection.character[0] ? resolveRow(bySection.character[0]) : null
      decks[`${ev.id}/${s.standing}`] = {
        n: deckName(s, ev),
        f: face ? face[0] : null,
        m: bySection.main.map(resolveRow).filter(Boolean),
        s: bySection.sideboard.map(resolveRow).filter(Boolean),
      }
    }
  }
  return { decks, unresolved }
}

const lists = buildSection({
  indexFile: 'locals-index.json',
  shardDir: 'locals',
  shardOf: shardKeyOf,
  standardOnly: true,
  deckName: (s) => s.deckName || 'UVS Deck', // LocalsPage.vue downloadTTS
})

const majors = buildSection({
  indexFile: 'majors-index.json',
  shardDir: 'majors',
  shardOf: (ev) => ev.season,
  standardOnly: false,
  deckName: (s, ev) => s.deckName || `${ev.name ?? 'Major'} Deck`, // MajorsPage.vue deckLabel
})

// ── Write ────────────────────────────────────────────────────────────────────

const outFile = path.join(root, 'netlify', 'edge-functions', 'lib', 'tts-data.js')
const data = { cards: table, lists: lists.decks, majors: majors.decks }
fs.writeFileSync(
  outFile,
  `// AUTO-GENERATED by scripts/gen-tts-manifest.mjs — do not edit by hand.\n` +
  `export default ${JSON.stringify(data)}\n`,
)

const kb = (fs.statSync(outFile).size / 1024).toFixed(0)
console.log(`Wrote ${path.relative(root, outFile)} (${kb} KB)`)
console.log(`  cards:  ${table.length}`)
console.log(`  lists:  ${Object.keys(lists.decks).length} decks`)
console.log(`  majors: ${Object.keys(majors.decks).length} decks`)
for (const [label, { unresolved }] of [['lists', lists], ['majors', majors]]) {
  if (!unresolved.size) continue
  console.warn(`  ${unresolved.size} /${label} cards unresolved (left out of the TTS deck, as on the page):`)
  for (const n of [...unresolved].slice(0, 15)) console.warn(`    - ${n}`)
}
