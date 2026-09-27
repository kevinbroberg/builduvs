/**
 * Reads lc-round1/ and lc-round2/ markdown folders,
 * populates data/locals.db, then exports src/assets/locals-index.json
 * and src/assets/locals-players.json.
 *
 * Player names are retained in the DB for querying but are NOT exported
 * to the JSON files — players are identified by character + standing only.
 *
 * Usage: node scripts/gen-locals.mjs
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildResolver } from '../src/js/card_lookup.js'
import { shardKeyOf } from '../src/js/event_naming.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dbPath = path.join(root, 'data', 'locals.db')
const outIndex   = path.join(root, 'src', 'assets', 'locals-index.json')
// Deck rows are written as one shard per /lists tab into public/, NOT as a
// bundled asset. Two reasons, both learned the hard way:
//
//  - Vite inlines every *imported* JSON into a JS chunk and parses it at build
//    time. locals-players.json became a 5.5MB chunk and majors-players.json a
//    7.7MB one, which is what ran the Netlify build out of heap. Files under
//    public/ are copied verbatim and never parsed, so they cost the build zero.
//  - A visitor opening one deck used to download every deck of every event to
//    read ~3KB. A tab shard is the exact working set for what the page shows.
const outShardDir = path.join(root, 'public', 'deck-data', 'locals')
// NOTE: locals.db is no longer copied to public/. The deck filter used to query
// it in the browser with sql.js, which meant the same 53k deck rows shipped
// twice — once as a 6.1MB binary (1.9MB gzipped, since sqlite compresses badly)
// and again inside the bundled players JSON. The filter now indexes the tab
// shard it already has in memory; the db here stays a build-time intermediate.

// ── Card ID lookup ────────────────────────────────────────────────────────────

// The decklist markdown stores card NAMES only (it is hand-edited, so it stays
// that way). Resolving those names to a stable id used to happen here, against a
// name-keyed view of cardeio-ids.json with a one-line normalizer — which missed
// any card whose vendor spelling differed by so much as an apostrophe. "Jin's
// Glove" ships from the vendor with U+2019 and sits in tekken8.json with U+0027,
// so all 46 decks playing it recorded a NULL id and the /lists card filter could
// not find a single one.
//
// That matching now happens once, offline, in scripts/build-card-crosswalk.mjs,
// which writes card-crosswalk.json and a report of everything it could not place.
// Here we just look up the answer. See src/js/card_lookup.js.
const crosswalk = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'card-crosswalk.json'), 'utf8'))
const resolveUvsId = buildResolver(crosswalk)

// cardeio_id is still written alongside uvs_id: it is what the pre-crosswalk
// rows used, and keeping it means an older locals.db and a freshly built one
// stay comparable while anything still reads that column.
const cardeioIds = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'cardeio-ids.json'), 'utf8'))
const normCardName = s => s.toLowerCase().replace(/['‘’‚‛′]/g, "'")
const cardeioIdByName = new Map(
  Object.entries(cardeioIds).map(([id, data]) => [normCardName(data.name), id])
)
const unresolvedCards = new Set()

// ── Schema ────────────────────────────────────────────────────────────────────

if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
const db = new Database(dbPath)

db.exec(`
  CREATE TABLE events (
    id            TEXT PRIMARY KEY,
    round         INTEGER NOT NULL,
    location      TEXT NOT NULL,
    date          TEXT NOT NULL,
    player_count  INTEGER NOT NULL,
    format_period TEXT NOT NULL
  );

  CREATE TABLE standings (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id       TEXT NOT NULL REFERENCES events(id),
    standing       INTEGER NOT NULL,
    player         TEXT NOT NULL,
    character_name TEXT,
    deck_name      TEXT,
    swiss_record   TEXT
  );

  CREATE TABLE deck_cards (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    standing_id INTEGER NOT NULL REFERENCES standings(id),
    section     TEXT NOT NULL CHECK(section IN ('character','main','sideboard')),
    qty         INTEGER NOT NULL,
    card_name   TEXT NOT NULL,
    cardeio_id  TEXT,
    -- Canonical card id ("tk802-049"), the column every card lookup should use.
    -- See src/js/card_id.js; cardeio_id is the legacy vendor key kept alongside.
    uvs_id      TEXT
  );

  CREATE INDEX idx_deck_cards_uvs ON deck_cards (uvs_id, section);

  CREATE TABLE matches (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    standing_id         INTEGER NOT NULL REFERENCES standings(id),
    phase               TEXT NOT NULL CHECK(phase IN ('swiss','topcut')),
    round_label         TEXT NOT NULL,
    opponent            TEXT,
    opponent_standing   INTEGER,
    opponent_character  TEXT,
    result              TEXT
  );
`)

// ── Parsers ───────────────────────────────────────────────────────────────────

// Split a markdown table row on unescaped "|" only, then unescape "\|" back to "|".
// Player names can legitimately contain a pipe ("BBBB | Maxwell P."); the round-4
// writer escapes those so the trailing fragment isn't mistaken for a column.
// Rows without backslashes split exactly as a naive split('|') would, so older
// (unescaped) round-1..3 files are unaffected.
function splitRow(line) {
  return line
    .split(/(?<!\\)\|/)
    .map(s => s.replace(/\\\|/g, '|').trim())
    .filter(Boolean)
}

function parseSummary(raw) {
  const lines = raw.split('\n')
  const titleMatch = lines[0].match(/^#\s+(.+?)\s+—\s+(\d{4}-\d{2}-\d{2})/)
  const location = titleMatch?.[1]?.trim() || ''
  const date = titleMatch?.[2] || ''
  const playersMatch = raw.match(/\*\*Players:\*\*\s+(\d+)/)
  const playerCount = parseInt(playersMatch?.[1] || '0')

  const standings = []
  let inTable = false
  for (const line of lines) {
    if (/^\|\s*#/.test(line)) { inTable = true; continue }
    if (inTable && /^\|[-|]/.test(line)) continue
    if (inTable && line.startsWith('|')) {
      const cells = splitRow(line)
      const num = parseInt(cells[0])
      if (!isNaN(num) && cells.length >= 2) {
        // Italic placeholders (_no decklist_, _unresolved_) are not real characters —
        // treat them as null so the character-section card fallback can fill in.
        const cell = cells[2]
        standings.push({
          standing: num,
          player: cells[1],
          characterName: (!cell || /^_.*_$/.test(cell)) ? null : cell,
        })
      }
    } else if (inTable && line.trim() !== '') break
  }
  return { location, date, playerCount, standings }
}

function parsePlayerFile(raw) {
  const lines = raw.split('\n')
  const deckMatch = raw.match(/\*\*Deck:\*\*\s+(.+)/)
  const deckName = deckMatch?.[1]?.trim() || null
  const swissMatch = raw.match(/## Swiss \(([^)]+)\)/)
  const swissRecord = swissMatch?.[1] || null

  let currentSec = null
  const secs = {}
  for (const line of lines) {
    const m = line.match(/^## (.+)/)
    if (m) {
      currentSec = m[1].replace(/\s*\([^)]*\)$/, '').trim()
      secs[currentSec] = []
    } else if (currentSec) {
      secs[currentSec].push(line)
    }
  }

  function parseTable(key) {
    const rows = (secs[key] || []).filter(l => l.startsWith('|') && !/^\|[-|]/.test(l))
    if (rows.length < 2) return []
    return rows.slice(1).map(splitRow)
  }

  function parseDeck(key) {
    return (secs[key] || [])
      .filter(l => /^\d+x/.test(l.trim()))
      .map(l => {
        const m = l.trim().match(/^(\d+)x\s+(.+)/)
        return m ? { qty: parseInt(m[1]), name: m[2] } : null
      })
      .filter(Boolean)
  }

  return {
    deckName,
    swissRecord,
    // carde.io labels the face-card section "Character"; the hydra/tabletop.gg
    // backend (Round 3 LCs onward + cardeio-2.0 regionals) labels it "Starting
    // Character". A file only ever has one, so concatenating picks up whichever.
    character: [...parseDeck('Character'), ...parseDeck('Starting Character')],
    mainDeck:  parseDeck('Main Deck'),
    sideboard: parseDeck('Sideboard'),
    swiss:     parseTable('Swiss'),
    topCut:    parseTable('Top Cut'),
  }
}

// ── Ingestion ─────────────────────────────────────────────────────────────────

// Apr 3 update effective Apr 13; May 5 update effective May 12
// Season 4 / Round 4 LCs start 2026-08-22 with Tekken 8 legal.
function formatPeriod(date) {
  if (date <= '2026-04-12') return 'kaiju'
  if (date <= '2026-05-11') return 'april'
  if (date <= '2026-06-12') return 'titan'
  if (date <= '2026-08-21') return 'mhafinal'
  return 'tekken8'
}

const insertEvent    = db.prepare(`INSERT INTO events VALUES (?,?,?,?,?,?)`)
const insertStanding = db.prepare(`INSERT INTO standings (event_id,standing,player,character_name,deck_name,swiss_record) VALUES (?,?,?,?,?,?)`)
const insertCard     = db.prepare(`INSERT INTO deck_cards (standing_id,section,qty,card_name,cardeio_id,uvs_id) VALUES (?,?,?,?,?,?)`)
const insertMatch    = db.prepare(`INSERT INTO matches (standing_id,phase,round_label,opponent,opponent_character,result) VALUES (?,?,?,?,?,?)`)

const ingest = db.transaction((roundDir, roundNum) => {
  const dirs = fs.readdirSync(roundDir).sort()
  for (const folder of dirs) {
    const eventDir = path.join(roundDir, folder)
    const summaryPath = path.join(eventDir, 'SUMMARY.md')
    if (!fs.existsSync(summaryPath)) continue

    const { location, date, playerCount, standings } = parseSummary(
      fs.readFileSync(summaryPath, 'utf8').replace(/^﻿/, '')
    )
    insertEvent.run(folder, roundNum, location, date, playerCount, formatPeriod(date))

    for (const s of standings) {
      const { lastInsertRowid: sid } = insertStanding.run(
        folder, s.standing, s.player, s.characterName, null, null
      )

      const prefix = String(s.standing).padStart(2, '0') + '-'
      const playerFile = fs.readdirSync(eventDir)
        .find(f => f.startsWith(prefix) && f.endsWith('.md'))

      if (playerFile) {
        const p = parsePlayerFile(fs.readFileSync(path.join(eventDir, playerFile), 'utf8').replace(/^﻿/, ''))
        // Fall back to first Character-section card if SUMMARY.md lacked the name
        const characterFallback = s.characterName == null && p.character.length > 0
          ? p.character[0].name : null
        db.prepare(`UPDATE standings SET deck_name=?, swiss_record=?, character_name=COALESCE(character_name,?) WHERE id=?`)
          .run(p.deckName, p.swissRecord, characterFallback, sid)

        const insertCards = (section, list) => {
          for (const c of list) {
            const uvs = resolveUvsId({ name: c.name })
            const id = cardeioIdByName.get(normCardName(c.name)) ?? null
            // Only a missing CANONICAL id is a real gap now — it means the card
            // is absent from src/assets/*.json, not that the name failed to
            // match. cardeio_id being null is expected for anything newer than
            // the legacy carde.io catalog (all of Tekken 8, for instance).
            if (!uvs) unresolvedCards.add(c.name)
            insertCard.run(sid, section, c.qty, c.name, id, uvs)
          }
        }
        insertCards('character', p.character)
        insertCards('main',      p.mainDeck)
        insertCards('sideboard', p.sideboard)

        for (const row of p.swiss) {
          insertMatch.run(sid, 'swiss', row[0], row[1] ?? null, row[2] ?? null, row[4] ?? null)
        }
        for (const row of p.topCut) {
          insertMatch.run(sid, 'topcut', row[0], row[1] ?? null, row[2] ?? null, row[4] ?? null)
        }
      }
    }
  }
})

ingest(path.join(root, 'lc-round1'), 1)
ingest(path.join(root, 'lc-round2'), 2)
ingest(path.join(root, 'lc-round3'), 3)
ingest(path.join(root, 'lc-round4'), 4)

const regionalsDir = path.join(root, 'regionals')
if (fs.existsSync(regionalsDir)) ingest(regionalsDir, 0)

// Resolve opponent_standing: join opponent name back to standings within same event
db.prepare(`
  UPDATE matches SET opponent_standing = (
    SELECT s2.standing
    FROM standings s1
    JOIN standings s2 ON s2.event_id = s1.event_id AND s2.player = matches.opponent
    WHERE s1.id = matches.standing_id
  )
`).run()

// Resolve opponent_character from the linked standing (covers new cards not in cardeio-ids.json)
db.prepare(`
  UPDATE matches SET opponent_character = (
    SELECT s2.character_name
    FROM standings s1
    JOIN standings s2 ON s2.event_id = s1.event_id AND s2.standing = matches.opponent_standing
    WHERE s1.id = matches.standing_id
  )
  WHERE opponent_standing IS NOT NULL
`).run()

// ── Export (no player names) ──────────────────────────────────────────────────

const events = db.prepare(`
  SELECT e.id, e.round, e.format_period AS formatPeriod, e.location, e.date,
         e.player_count AS playerCount,
         s.character_name AS winnerCharacter
  FROM events e
  LEFT JOIN standings s ON s.event_id = e.id AND s.standing = 1
  ORDER BY e.date
`).all()

const allStandings = db.prepare(`
  SELECT id, event_id AS eventId, standing, character_name AS characterName,
         deck_name AS deckName, swiss_record AS swissRecord
  FROM standings
  ORDER BY event_id, standing
`).all()

const allCards = db.prepare(`
  -- cardeio_id is deliberately NOT exported. It stays in the db (and in
  -- locals.db, which the sql.js filter queries), but in this JSON it is dead
  -- weight: uvs_id covers 100% of rows and supersedes it, while the Mongo OIDs
  -- are the single largest field here. Dropping it takes locals-players.json
  -- from 7.97MB to 6.00MB — and this file is parsed and re-emitted as a JS
  -- chunk by Vite, which is what ran the Netlify build out of heap.
  SELECT standing_id AS standingId, section, qty, card_name AS name, uvs_id AS uvsId
  FROM deck_cards
  ORDER BY standing_id, section, id
`).all()

const allMatches = db.prepare(`
  SELECT standing_id AS standingId, phase, round_label AS round,
         opponent_standing AS opponentStanding,
         opponent_character AS opponentCharacter, result
  FROM matches
  ORDER BY standing_id, phase, id
`).all()

// ── Stable standing keys ────────────────────────────────────────────────────
// standings.id is an AUTOINCREMENT rowid, so it is *positional*: rounds ingest
// in order (round1 → … → round4 → regionals), which means adding a single event
// to round 1 renumbers every standing in every later round and rewrites every
// shard from top to bottom. Enormous diffs for a one-event change.
//
// The exported key is therefore a natural one — "<eventId>#<placing>" — which
// depends only on that standing's own identity. Adding an event now adds only
// its own entries. It is also readable in a diff: you can see which deck moved.
//
// Nothing downstream does arithmetic on this; the index, the shards, the pages
// and compute-deck-symbols all pass it through opaquely as an opaque key.
const keyById = new Map(allStandings.map(s => [s.id, `${s.eventId}#${s.standing}`]))

// `standingId` is dropped from each row: it duplicated the key it is stored
// under, 150,695 times over, for 2.5MB of nothing.
const groupByStanding = (rows) => {
  const out = {}
  for (const r of rows) {
    const key = keyById.get(r.standingId)
    if (!key) continue
    const { standingId, ...rest } = r
    ;(out[key] ??= []).push(rest)
  }
  return out
}

const cardsByStanding = groupByStanding(allCards)

// Group by event/standing. hasDeck marks standings that actually have a decklist
// (any ingested cards) — distinct from deckName, which is just the optional
// archetype label. The UI keys link/clickability off hasDeck so unnamed lists
// still link.
const standingsByEvent = {}
for (const s of allStandings) {
  if (!standingsByEvent[s.eventId]) standingsByEvent[s.eventId] = []
  const key = keyById.get(s.id)
  standingsByEvent[s.eventId].push({ ...s, id: key, hasDeck: (cardsByStanding[key]?.length ?? 0) > 0 })
}

const matchesByStanding = groupByStanding(allMatches)

// Serialize with object keys in sorted order. JSON.stringify follows insertion
// order, which here is SQL row order — so an unrelated upstream change could
// reshuffle a whole file without any content actually differing. Sorting makes
// the bytes a pure function of the data, which is what keeps diffs readable and
// reviewable.
const stableStringify = (value) => JSON.stringify(value, (_k, v) =>
  (v && typeof v === 'object' && !Array.isArray(v))
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))
    : v)

fs.writeFileSync(outIndex, stableStringify({ events, standings: standingsByEvent }))

// ── deck-data shards, one per tab ───────────────────────────────────────────
// shardKeyOf is imported from event_naming.js, the same module the page uses to
// decide which shard to fetch — so writer and reader can't drift apart.
const eventById = new Map(events.map(e => [e.id, e]))
const shardOfStanding = new Map()
for (const [evId, list] of Object.entries(standingsByEvent)) {
  const shard = shardKeyOf(eventById.get(evId))
  for (const s of list) shardOfStanding.set(s.id, shard)
}

const shards = {}
const bucket = key => (shards[key] ??= { cards: {}, matches: {} })
for (const [sid, rows] of Object.entries(cardsByStanding)) {
  const shard = shardOfStanding.get(sid)
  if (shard) bucket(shard).cards[sid] = rows
}
for (const [sid, rows] of Object.entries(matchesByStanding)) {
  const shard = shardOfStanding.get(sid)
  if (shard) bucket(shard).matches[sid] = rows
}

// Rewrite the directory so a renamed or removed tab can't leave a stale shard
// behind for the page to fetch.
fs.rmSync(outShardDir, { recursive: true, force: true })
fs.mkdirSync(outShardDir, { recursive: true })
let shardBytes = 0
for (const [key, data] of Object.entries(shards)) {
  const file = path.join(outShardDir, `${key}.json`)
  fs.writeFileSync(file, stableStringify(data))
  shardBytes += fs.statSync(file).size
}

const idCoverage = db.prepare(`
  SELECT COUNT(*) AS total, SUM(uvs_id IS NOT NULL) AS resolved FROM deck_cards
`).get()
console.log(`\ncanonical card ids: ${idCoverage.resolved}/${idCoverage.total} deck rows (${(100 * idCoverage.resolved / idCoverage.total).toFixed(1)}%)`)

if (unresolvedCards.size) {
  console.warn(`\nCards with no canonical id (${unresolvedCards.size}) — these are missing from src/assets/*.json:`)
  for (const name of [...unresolvedCards].sort()) console.warn(`  - ${name}`)
}

const stats = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM events)     AS events,
    (SELECT COUNT(*) FROM standings)  AS standings,
    (SELECT COUNT(*) FROM deck_cards) AS cards,
    (SELECT COUNT(*) FROM matches)    AS matches,
    (SELECT COUNT(*) FROM matches WHERE opponent_standing IS NOT NULL) AS resolved_opponents
`).get()
console.log('DB rows:', stats)
console.log('index:  ', Math.round(fs.statSync(outIndex).size / 1024), 'KB (bundled)')
const sizes = Object.keys(shards).map(k => fs.statSync(path.join(outShardDir, `${k}.json`)).size)
sizes.sort((a, b) => a - b)
console.log(`shards:  ${sizes.length} files, ${Math.round(shardBytes / 1024)} KB total, `
  + `median ${Math.round(sizes[sizes.length >> 1] / 1024)} KB, max ${Math.round(sizes[sizes.length - 1] / 1024)} KB`
  + ` → ${path.relative(root, outShardDir)}`)

db.close()
