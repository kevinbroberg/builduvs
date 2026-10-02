/**
 * Generates netlify/edge-functions/preview-data.js — a compact manifest the
 * edge function uses to inject per-URL Open Graph / Twitter meta tags so that
 * links to /lists and /majors (index, :event, and :event/:id) get rich previews
 * (title, description, and a character-card image) when shared.
 *
 * Re-run this whenever locals-index.json or majors-index.json changes — i.e.
 * after gen-locals.mjs / gen-majors.mjs and their compute-deck-symbols pass,
 * since the preview description reads deckSymbol and overallRecord:
 *
 *   node scripts/gen-preview-manifest.mjs
 *
 * The output is committed so no build-step wiring is required.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { eventName } from '../src/js/event_naming.js'
import { tierInfo, seasonLabel } from '../src/js/major_naming.js'
import { normName, lookupKeys, buildNameIndex } from '../src/js/card_name_match.js'
import { buildResolver } from '../src/js/card_lookup.js'
import { uvsId } from '../src/js/card_id.js'
import { deckSymbolLabel } from '../src/js/deck_symbol.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assets = path.join(root, 'src', 'assets')

const CDN_BASE = 'https://pub-aa47ca6c03d2428a9e22ac6b5d839945.r2.dev'
const SITE_BASE = 'https://builduvs.com'

// ── Card name → CDN image URL ───────────────────────────────────────────────
// Mirrors src/js/card_provider.js (asset synthesis, standard-only filter) and
// src/pages/LocalsPage.vue (normName + findCard fallbacks) so images resolve
// identically to what the app shows.

const CARD_FILES = [
  'sf6-2026.json', 'tekken8.json', 'mha09.json', 'kaiju.json', 'teamhero.json', 'gg-critrole.json',
  'sjw-mha4.json', 'heroesclash.json', 'rampage_dlc.json', 'provs.json',
  'rampage.json', 'cards.json',
]

function loadCards() {
  const out = []
  for (const f of CARD_FILES) {
    const p = path.join(assets, f)
    if (!fs.existsSync(p)) continue
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'))
    for (const c of arr) {
      if (!c.asset) c.asset = `${c.extension_short}/${c.card_number_image}`
      out.push(c)
    }
  }
  return out
}

const loadedCards = loadCards()
const standardCards = loadedCards.filter(c => c.formats?.includes('standard'))

/**
 * Builds a name→image resolver over a card pool.
 *
 * /lists covers current-format events so standard-only keeps lookups
 * unambiguous. Majors reach back to 2024, where most of the field has since
 * rotated out, so it must see every printing or most historical character art
 * would not resolve.
 */
const resolveUvsId = buildResolver(JSON.parse(fs.readFileSync(path.join(assets, 'card-crosswalk.json'), 'utf8')))

function makeResolver(standardOnly) {
  const pool = standardOnly ? standardCards : loadedCards
  // Exact names first, then diacritic-folded aliases, so an alias never
  // displaces a real card. Suffix stripping is query-side only (see findCard).
  const cardByName = buildNameIndex(pool)
  if (!standardOnly) for (const c of standardCards) cardByName.set(normName(c.name), c)

  function findCard(name) {
    if (!name) return null
    const n = normName(name)
    for (const k of lookupKeys(name)) {
      const card = cardByName.get(k)
      if (card) return card
    }
    if (n.includes(' // ')) {
      const front = n.split(' // ')[0].trim()
      for (const k of lookupKeys(front)) {
        const card = cardByName.get(k)
        if (card) return card
      }
    }
    const yearStripped = n.replace(/,\s*\d{4}.*/, '').trim()
    if (yearStripped !== n) {
      const card = cardByName.get(yearStripped)
      if (card) return card
    }
    if (n.includes('$')) {
      const card = cardByName.get(n.replaceAll('$', 's'))
      if (card) return card
    }
    return null
  }

  // Last resort: the offline crosswalk, which knows the vendor's spelling of
  // every card as well as ours. It is what catches a name this file's own
  // matcher would miss for want of an apostrophe.
  const byUvs = new Map(pool.filter(c => uvsId(c)).map(c => [uvsId(c), c]))

  return name => {
    const c = findCard(name) || byUvs.get(resolveUvsId({ name }))
    return c ? `${CDN_BASE}/${c.asset}` : null
  }
}

const cardImage       = makeResolver(true)
const majorsCardImage = makeResolver(false)

// ── Display helpers (mirror LocalsPage.vue) ─────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const toTitleCase = s => (s ? s.replace(/(?<!['‘’‚‛′])\b\w/g, c => c.toUpperCase()) : '')
const formatDate = iso => {
  const [, m, d] = iso.split('-')
  return `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}`
}
// Majors span multiple seasons, so their previews need the year to be legible.
const formatDateY = iso => {
  const [y] = iso.split('-')
  return `${formatDate(iso)}, ${y}`
}
const ordinal = n => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

const joinParts = (...parts) => parts.filter(Boolean).join(' · ')

// ── Build the manifest ──────────────────────────────────────────────────────

const index = JSON.parse(fs.readFileSync(path.join(assets, 'locals-index.json'), 'utf8'))
const { events, standings } = index
const eventById = new Map(events.map(e => [e.id, e]))

const manifest = {
  index: {
    title: 'Decklists · BuildUVS',
    description: 'Browse tournament and locals decklists for Universus.',
    image: null,
  },
  events: {},
  players: {},
}

for (const ev of events) {
  const rows = standings[ev.id] || []
  const deckCount = rows.filter(s => s.hasDeck).length
  manifest.events[ev.id] = {
    title: joinParts(eventName(ev), formatDate(ev.date)),
    description: joinParts(
      ev.winnerCharacter ? `Won by ${toTitleCase(ev.winnerCharacter)}` : null,
      `${deckCount} decklist${deckCount === 1 ? '' : 's'}`,
      `${ev.playerCount} players`,
    ),
    image: ev.winnerCharacter ? cardImage(ev.winnerCharacter) : null,
  }

  // Only standings with a deck are linkable (opponent links + the standings UI),
  // so only those need a preview entry — keeps the manifest small.
  for (const s of rows) {
    if (!s.hasDeck) continue
    const record = s.overallRecord ?? s.swissRecord ?? null
    manifest.players[`${ev.id}/${s.standing}`] = {
      // "<Event name> <Nth> place <Character>"
      title: [eventName(ev), `${ordinal(s.standing)} place`, toTitleCase(s.characterName)]
        .filter(Boolean).join(' '),
      description: joinParts(
        s.deckSymbol ? toTitleCase(deckSymbolLabel(s.deckSymbol)) : null,
        record,
        formatDate(ev.date),
      ),
      // Raw character card art from the CDN — free, no generation/upload step.
      // (A richer composed share card is available via scripts/gen-og-images.mjs;
      // see that script's header to switch this back to og/lists/<...>.jpg.)
      image: cardImage(s.characterName),
    }
  }
}

// ── Majors (/majors, /majors/:event, /majors/:event/:id) ────────────────────
// Kept in its own namespace so the /lists entries above stay byte-identical.

const majorsPath = path.join(assets, 'majors-index.json')
if (fs.existsSync(majorsPath)) {
  const majorsIndex = JSON.parse(fs.readFileSync(majorsPath, 'utf8'))
  const seasons = [...new Set(majorsIndex.events.map(e => e.season))].sort().reverse()

  manifest.majors = {
    index: {
      title: 'Majors · BuildUVS',
      description: joinParts(
        `${majorsIndex.events.length} events`,
        seasons.map(seasonLabel).join(' & '),
      ),
      image: null,
    },
    events: {},
    players: {},
  }

  for (const ev of majorsIndex.events) {
    const rows = majorsIndex.standings[ev.id] || []
    const deckCount = rows.filter(s => s.hasDeck).length
    manifest.majors.events[ev.id] = {
      title: joinParts(ev.name, formatDateY(ev.date)),
      description: joinParts(
        tierInfo(ev.tier).label,
        ev.winnerCharacter ? `Won by ${toTitleCase(ev.winnerCharacter)}` : null,
        `${deckCount} decklist${deckCount === 1 ? '' : 's'}`,
        `${ev.playerCount} players`,
      ),
      image: ev.winnerCharacter ? majorsCardImage(ev.winnerCharacter) : null,
    }

    for (const s of rows) {
      if (!s.hasDeck) continue
      manifest.majors.players[`${ev.id}/${s.standing}`] = {
        title: [ev.name, `${ordinal(s.standing)} place`, toTitleCase(s.characterName)]
          .filter(Boolean).join(' '),
        description: joinParts(
          s.deckSymbol ? toTitleCase(deckSymbolLabel(s.deckSymbol)) : null,
          s.overallRecord ?? s.swissRecord ?? null,
          formatDateY(ev.date),
        ),
        image: majorsCardImage(s.characterName),
      }
    }
  }
}

// Data lives in a subdirectory: Netlify registers only top-level files in
// netlify/edge-functions/ as functions; subdirectories are import-only helpers.
const outDir = path.join(root, 'netlify', 'edge-functions', 'lib')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'preview-data.js')
fs.writeFileSync(
  outFile,
  `// AUTO-GENERATED by scripts/gen-preview-manifest.mjs — do not edit by hand.\n` +
  `export const SITE_BASE = ${JSON.stringify(SITE_BASE)}\n` +
  `export default ${JSON.stringify(manifest)}\n`,
)

const missing = new Set()
for (const ev of events) {
  if (ev.winnerCharacter && !cardImage(ev.winnerCharacter)) missing.add(ev.winnerCharacter)
  for (const s of (standings[ev.id] || [])) {
    if (s.hasDeck && s.characterName && !cardImage(s.characterName)) missing.add(s.characterName)
  }
}

const missingMajors = new Set()
if (manifest.majors) {
  for (const [key, entry] of Object.entries(manifest.majors.events)) {
    if (!entry.image) missingMajors.add(`event ${key}`)
  }
  for (const [key, entry] of Object.entries(manifest.majors.players)) {
    if (!entry.image) missingMajors.add(`player ${key}`)
  }
}

console.log(`Wrote ${path.relative(root, outFile)}`)
console.log(`  lists:  ${Object.keys(manifest.events).length} events, ${Object.keys(manifest.players).length} player previews`)
if (manifest.majors) {
  console.log(`  majors: ${Object.keys(manifest.majors.events).length} events, ${Object.keys(manifest.majors.players).length} player previews`)
}
if (missing.size) {
  console.warn(`  ${missing.size} /lists characters had no card image:`)
  for (const m of missing) console.warn(`    - ${m}`)
}
if (missingMajors.size) {
  console.warn(`  ${missingMajors.size} /majors entries had no card image:`)
  for (const m of [...missingMajors].slice(0, 15)) console.warn(`    - ${m}`)
}
