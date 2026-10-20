/**
 * Build the uvsId → Hydra card name table the deck export writes decklists with.
 *
 * Export to play.uvsgames.com goes through Hydra's text import, which resolves
 * cards by *name*. It already forgives case and straight-vs-curly apostrophes,
 * so most of our names go through untouched. What it can't forgive:
 *
 *   double-sided cards   Hydra knows only "Annie Leonhart // Annie, Female Titan";
 *                        we hold each side as its own record (back = "B" number)
 *   naming drift         "Arrows & Daggers" vs "Arrows and Daggers",
 *                        "Ibara Shiozaki" vs "Ibara Shiozaki (I)", …
 *
 * The id crosswalk (build-card-crosswalk.mjs) already pins each Hydra card to one
 * of ours, so this just inverts it and keeps the names that differ. Cards with no
 * entry export under their own name; Hydra's validator reports any that miss.
 *
 * Usage: node scripts/build-hydra-names.mjs   (after build-card-crosswalk.mjs)
 * Reads:  src/assets/card-crosswalk.json, data/hydra-uvs-catalog.json
 * Writes: src/assets/hydra-names.json
 */
import fs from 'fs'
import path from 'path'
import { uvsId, parseUvsId, formatUvsId } from '../src/js/card_id.js'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..')
const p = (...xs) => path.join(root, ...xs)
const readJson = f => JSON.parse(fs.readFileSync(p(f), 'utf8'))

const CARD_FILES = [
  'heroesclash.json', 'rampage_dlc.json', 'rampage.json', 'provs.json',
  'gg-critrole.json', 'sjw-mha4.json', 'cards.json', 'kaiju.json',
  'teamhero.json', 'mha09.json', 'tekken8.json', 'sf6-2026.json',
  'fairytail.json',
]

// The comparison Hydra's importer effectively makes.
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[‘’ʼ]/g, "'").trim().toLowerCase()

const { byHydraId } = readJson('src/assets/card-crosswalk.json')
const catalog = readJson('data/hydra-uvs-catalog.json')
const hydraName = new Map(catalog.map(r => [r.id, r.name]))

// uvsId → Hydra name. Several Hydra rows can land on one of our cards: remastered
// reprints (same name, either wins) and double-sided cards, which also have a
// one-sided row under the front's bare name. The importer only resolves the pair
// as "Front // Back", so a "//" name always wins.
const nameByUvsId = new Map()
for (const [hydraId, id] of Object.entries(byHydraId)) {
  const name = hydraName.get(hydraId)
  if (!name) continue
  const prev = nameByUvsId.get(id)
  if (!prev || (name.includes(' // ') && !prev.includes(' // '))) nameByUvsId.set(id, name)
}

const allCards = CARD_FILES.flatMap(f => readJson(`src/assets/${f}`))
const ourName = new Map(allCards.map(c => [uvsId(c), c.name]))

const out = {}
const unresolved = []
for (const card of allCards) {
  const id = uvsId(card)
  if (!id || out[id]) continue
  let name = nameByUvsId.get(id)
  // A double-sided back exports as its front: Hydra holds the pair as one card.
  // If even the front has no crosswalk match, its bare name is still the best
  // guess (Hydra sometimes carries such a card one-sided, e.g. Sung Jinwoo).
  if (!name) {
    const parsed = parseUvsId(id)
    if (parsed?.suffix === 'b') {
      const front = formatUvsId({ ...parsed, suffix: '' })
      name = nameByUvsId.get(front) ?? ourName.get(front)
    }
  }
  if (!name) {
    if ((card.formats || []).includes('standard') && card.type !== 'token') unresolved.push(`${id}  ${card.name}`)
    continue
  }
  if (norm(name) !== norm(card.name)) out[id] = name
}

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
fs.writeFileSync(p('src/assets/hydra-names.json'), JSON.stringify({
  _generated: new Date().toISOString(),
  _note: 'uvsId → Hydra card name, only where it differs from ours. Built by scripts/build-hydra-names.mjs; do not hand-edit.',
  names: sorted,
}, null, 1) + '\n')

console.log(`wrote ${Object.keys(sorted).length} renames to src/assets/hydra-names.json`)
console.log(`${unresolved.length} standard-legal cards have no Hydra match (export under their own name):`)
for (const u of unresolved) console.log('  ' + u)
