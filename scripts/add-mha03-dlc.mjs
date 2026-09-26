/**
 * One-off: fold the Heroes Clash DLC (the Wild Wild Pussycats, mha03/220–231)
 * into src/assets/heroesclash.json.
 *
 * Why it was missing: UVSUltra files this DLC under the same extension as
 * Heroes Clash itself (id 102, `mha03`), tucked in the 212–239 number gap above
 * the Plus Ultra pack — so a scrape that stopped at the base set's numbering
 * skipped it silently. It surfaced only when the card-id crosswalk started
 * reporting unresolved decklist names: 10 of the 12 remaining were this set,
 * including "Rag Doll (I)", "Tiger (I)" and "Happy-Go-Lucky", which read like
 * unrelated promos but are the other Pussycats and their foundation.
 *
 * Records are written to match heroesclash.json's existing conventions rather
 * than the scraper's raw output — `block_mod` not `block_modifier`, a relative
 * `ultra_url_path`, no `numero` (this file has never carried one; `asset` is the
 * identity, see src/js/card_id.js), and per-type field ordering.
 *
 * Names keep UVSUltra's spelling ("Rag Doll", not carde.io's "Rag Doll (I)"),
 * matching the rest of the file. Decklists that use the suffixed form still
 * resolve — the crosswalk strips a trailing roman numeral.
 *
 * Usage: node scripts/add-mha03-dlc.mjs [--dry]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const p = (...a) => path.join(root, ...a)
const DRY = process.argv.includes('--dry')

const SCRAPE = process.env.MHA03_SCRAPE || path.join(process.env.TEMP || '/tmp', 'mha03-full.json')
if (!fs.existsSync(SCRAPE)) {
  console.error(`missing scrape: ${SCRAPE}\nrun: node scripts/fetch-set.mjs --id 102 --out ${SCRAPE}`)
  process.exit(1)
}

const scraped = JSON.parse(fs.readFileSync(SCRAPE, 'utf8'))
const target = p('src', 'assets', 'heroesclash.json')
const existing = JSON.parse(fs.readFileSync(target, 'utf8'))

const numOf = c => Number(/\/(\d+)/.exec(c.asset)[1])
const have = new Set(existing.map(numOf))
const incoming = scraped.filter(c => !have.has(Number(c.numero)))

if (!incoming.length) { console.log('nothing to add'); process.exit(0) }

// carde.io ids, via the Hydra catalog (uvs03-dlc) and the legacy id→slug map.
const catalog = JSON.parse(fs.readFileSync(p('data', 'hydra-uvs-catalog.json'), 'utf8'))
const legacy = JSON.parse(fs.readFileSync(p('src', 'assets', 'cardeio-ids.json'), 'utf8'))
const norm = s => (s || '').toLowerCase().replace(/[‘’]/g, "'")
  .replace(/\s*\((?:i{1,3}|iv|v)\)\s*$/, '').replace(/\s+/g, ' ').trim()
const hydraByName = new Map(
  catalog.filter(c => c.cardSet === 'uvs03-dlc').map(c => [norm(c.name), c])
)

// heroesclash.json's field order, per card type. Kept explicit so a diff of the
// file stays readable next to the 171 records already in it.
const ORDER = {
  character:  ['extension','formats','asset','ultra_url_path','name','type','rarity','text','keywords','resources','difficulty','control','block_zone','block_mod','hand_size','vitality','cardeio_id','cardeio_slug'],
  attack:     ['extension','formats','asset','ultra_url_path','name','type','rarity','text','keywords','resources','difficulty','control','block_zone','block_mod','speed','attack_zone','damage','cardeio_id','cardeio_slug'],
  foundation: ['extension','formats','asset','ultra_url_path','name','type','rarity','text','keywords','resources','difficulty','control','block_zone','block_mod','cardeio_id','cardeio_slug'],
}

const built = incoming.map(c => {
  const n = String(c.numero).padStart(3, '0')
  const hydra = hydraByName.get(norm(c.name))
  const cardeioId = hydra && /^[0-9a-f]{24}$/.test(hydra.externalId || '') ? hydra.externalId : null

  const rec = {
    extension: 'Heroes Clash',
    // Matches the other 171 records in this file. NOTE: UVSUltra now also tags
    // every Heroes Clash card `legacy`, which this file predates — deliberately
    // not changed here, since adding it to 12 of 183 cards would be worse than
    // leaving all 183 consistent. Worth a separate refresh pass.
    formats: ['retro', 'My Hero Academia'],
    asset: `mha03/${n}.jpg`,
    ultra_url_path: `images/extensions/mha03/${n}.jpg`,
    name: c.name,
    type: c.type,
    rarity: c.rarity,
    text: c.text,
    keywords: c.keywords,
    resources: c.resources,
    difficulty: c.difficulty,
    control: c.control,
    block_zone: c.block_zone,
    block_mod: c.block_modifier,
    speed: c.speed,
    attack_zone: c.attack_zone,
    damage: c.damage,
    hand_size: c.hand_size,
    vitality: c.vitality,
    cardeio_id: cardeioId,
    cardeio_slug: cardeioId ? legacy[cardeioId]?.slug ?? null : null,
  }

  const out = {}
  for (const k of ORDER[c.type] ?? ORDER.foundation) {
    if (rec[k] !== undefined && rec[k] !== null) out[k] = rec[k]
  }
  return out
})

// heroesclash.json is sorted by collector number; keep it that way.
const merged = [...existing, ...built].sort((a, b) => numOf(a) - numOf(b))

console.log(`adding ${built.length} card(s) to heroesclash.json (${existing.length} → ${merged.length})`)
for (const c of built) {
  console.log(`  ${c.asset}  ${c.name.padEnd(24)} ${String(c.type).padEnd(11)} ${c.cardeio_id ? '' : '(no cardeio_id)'}`)
}

if (DRY) { console.log('\n--dry: nothing written'); console.log(JSON.stringify(built[0], null, 1)); process.exit(0) }

fs.writeFileSync(target, JSON.stringify(merged, null, 2) + '\n')
console.log(`\nwrote ${target}`)
