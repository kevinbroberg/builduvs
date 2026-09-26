/**
 * Harvest the full UniVersus card catalog from the public Hydra deckbuilder API
 * (no auth). This is the authoritative structured source for set + collector
 * number — the spine the card-id refactor is built on. Discovered via the
 * play.uvsgames.com/cards gallery network traffic.
 *
 *   POST https://api-hydra.carde.io/api/v2/deckbuilder/cards/search-with-filters/
 *   body: { game_id: 298, filters: {}, limit, offset }
 *
 * Usage: node scripts/fetch-hydra-catalog.mjs
 * Writes: data/hydra-uvs-catalog.json  (+ prints a set breakdown)
 */
import fs from 'fs'
import path from 'path'

const URL = 'https://api-hydra.carde.io/api/v2/deckbuilder/cards/search-with-filters/'
const HEADERS = {
  'Content-Type': 'application/json',
  'Referer': 'https://play.uvsgames.com/',
  'user-agent': 'Mozilla/5.0',
}
const GAME_ID = 298
const PAGE = 200
const OUT = path.resolve('data/hydra-uvs-catalog.json')

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function page(offset) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ game_id: GAME_ID, filters: {}, sort_by: 'name', sort_order: 'asc', limit: PAGE, offset }),
  })
  if (!r.ok) throw new Error(`${r.status} at offset ${offset}`)
  return r.json()
}

const all = []
let offset = 0
for (;;) {
  const j = await page(offset)
  all.push(...j.cards)
  process.stderr.write(`\r  fetched ${all.length}/${j.total}`)
  if (!j.has_more) break
  offset += PAGE
  await sleep(120)
}
process.stderr.write('\n')

// Flatten the useful identity fields to the top level for convenience; keep the
// raw attribute_values too so nothing is lost.
// Hydra wraps enum-valued attributes as { option, annotations } (it used to
// return bare strings). Unwrap either shape so the flat file stays stable.
const opt = v => (v && typeof v === 'object' && 'option' in v ? v.option : v) ?? null

const flat = all.map(c => {
  const a = c.attribute_values || {}
  return {
    id: c.id,
    name: c.name,
    displayName: c.display_name,
    cardType: opt(c.card_type),
    cardSet: opt(a['Card Set']),
    collectorNumber: opt(a['Collector Number']),
    rarity: opt(a['Rarity']),
    ip: opt(a['IP']),
    imageUrl: c.image_url,
    backImageUrl: c.back_image_url,
    isRemastered: c.is_remastered,
    bundledCards: c.bundled_cards,
    externalId: c.external_id,
    raw: c,
  }
})

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(flat, null, 2))

// ── report ──────────────────────────────────────────────────────────────────
const bySet = new Map()
for (const c of flat) {
  const k = c.cardSet || '(none)'
  bySet.set(k, (bySet.get(k) || 0) + 1)
}
console.log(`\ncards: ${flat.length}   distinct sets: ${bySet.size}   file: ${OUT}`)
const missingNum = flat.filter(c => c.collectorNumber == null).length
const missingSet = flat.filter(c => c.cardSet == null).length
console.log(`missing collectorNumber: ${missingNum}   missing cardSet: ${missingSet}`)

console.log('\nMHA-family sets (the ones uvsultra fuses into "mha01"):')
for (const [s, n] of [...bySet].sort())
  if (/hero|mha|quirk|plus|toga|eraser|dlc|uvs0[1-9]/i.test(s)) console.log(`  ${s.padEnd(46)} ${String(n).padStart(4)}`)

// exact-name un-lumping demo: any card name that appears in >1 set
const byName = new Map()
for (const c of flat) {
  const k = c.name.toLowerCase()
  if (!byName.has(k)) byName.set(k, [])
  byName.get(k).push(c)
}
const multi = [...byName.values()].filter(v => new Set(v.map(c => c.cardSet)).size > 1)
console.log(`\nnames printed in >1 set (reprints/alt prints): ${multi.length}`)
