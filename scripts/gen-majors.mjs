/**
 * Reads the majors/ markdown folders, populates data/majors.db, then exports
 * src/assets/majors-index.json and src/assets/majors-players.json.
 *
 * This is the historical-majors sibling of gen-locals.mjs. It stays a separate
 * script and a separate database because majors are grouped by competitive
 * season and event tier (Worlds / Nationals / Major Regional / ...) rather than
 * by the LC round + format-period scheme that drives /lists.
 *
 * Player names are retained in the DB for opponent linking but are NOT exported
 * to the JSON — players are identified by character + standing only, matching
 * the locals pipeline.
 *
 * Usage: node scripts/gen-majors.mjs
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildResolver } from '../src/js/card_lookup.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const majorsDir  = path.join(root, 'majors')
const dbPath     = path.join(root, 'data', 'majors.db')
const outIndex   = path.join(root, 'src', 'assets', 'majors-index.json')
// Deck rows go to public/ as one shard per SEASON tab, not into the bundle —
// see the matching note in gen-locals.mjs. majors-players.json was a 7.7MB JS
// chunk that Vite had to parse on every build.
const outShardDir = path.join(root, 'public', 'deck-data', 'majors')

// ── Card ID lookup ────────────────────────────────────────────────────────────

// Card names in the majors markdown resolve to a canonical id through the
// offline crosswalk, same as gen-locals.mjs. See scripts/build-card-crosswalk.mjs
// for why the name matching moved out of the pipelines entirely.
const crosswalk = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'card-crosswalk.json'), 'utf8'))
const resolveUvsId = buildResolver(crosswalk)

const cardeioIds = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'cardeio-ids.json'), 'utf8'))
const normCardName = s => s.toLowerCase().replace(/['‘’‚‛′]/g, "'")
const cardeioIdByName = new Map(
  Object.entries(cardeioIds).map(([id, data]) => [normCardName(data.name), id])
)
const unresolvedCards = new Set()

// ── Schema ────────────────────────────────────────────────────────────────────

fs.mkdirSync(path.dirname(dbPath), { recursive: true })
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
const db = new Database(dbPath)

db.exec(`
  CREATE TABLE events (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    tier          TEXT NOT NULL,
    season        TEXT NOT NULL,
    location      TEXT NOT NULL,
    date          TEXT NOT NULL,
    player_count  INTEGER NOT NULL
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
    -- Canonical card id ("tk802-049"); see src/js/card_id.js.
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

// Split a markdown table row on unescaped "|" only, then unescape "\|" back to
// "|" — player names can legitimately contain a pipe, and fetch-majors.mjs
// escapes those so the trailing fragment isn't mistaken for a column.
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
  const name   = raw.match(/\*\*Event:\*\*\s+(.+)/)?.[1]?.trim() || ''
  const tier   = raw.match(/\*\*Tier:\*\*\s+(.+)/)?.[1]?.trim() || ''
  const season = raw.match(/\*\*Season:\*\*\s+(.+)/)?.[1]?.trim() || ''
  const playerCount = parseInt(raw.match(/\*\*Players:\*\*\s+(\d+)/)?.[1] || '0')

  const standings = []
  let inTable = false
  for (const line of lines) {
    if (/^\|\s*#/.test(line)) { inTable = true; continue }
    if (inTable && /^\|[-|]/.test(line)) continue
    if (inTable && line.startsWith('|')) {
      const cells = splitRow(line)
      const num = parseInt(cells[0])
      if (!isNaN(num) && cells.length >= 2) {
        // Italic placeholders (_no decklist_) are not real characters — null them
        // so the character-section fallback can fill in.
        const cell = cells[2]
        standings.push({
          standing: num,
          player: cells[1],
          characterName: (!cell || /^_.*_$/.test(cell)) ? null : cell,
        })
      }
    } else if (inTable && line.trim() !== '') break
  }
  return { name, tier, season, location, date, playerCount, standings }
}

function parsePlayerFile(raw) {
  const lines = raw.split('\n')
  const deckName = raw.match(/\*\*Deck:\*\*\s+(.+)/)?.[1]?.trim() || null
  const swissRecord = raw.match(/## Swiss \(([^)]+)\)/)?.[1] || null

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

  const parseTable = key => {
    const rows = (secs[key] || []).filter(l => l.startsWith('|') && !/^\|[-|]/.test(l))
    if (rows.length < 2) return []
    return rows.slice(1).map(splitRow)
  }

  const parseDeck = key => (secs[key] || [])
    .filter(l => /^\d+x/.test(l.trim()))
    .map(l => {
      const m = l.trim().match(/^(\d+)x\s+(.+)/)
      return m ? { qty: parseInt(m[1]), name: m[2] } : null
    })
    .filter(Boolean)

  return {
    deckName,
    swissRecord,
    character: parseDeck('Character'),
    mainDeck:  parseDeck('Main Deck'),
    sideboard: parseDeck('Sideboard'),
    swiss:     parseTable('Swiss'),
    topCut:    parseTable('Top Cut'),
  }
}

// ── Ingestion ─────────────────────────────────────────────────────────────────

const insertEvent    = db.prepare(`INSERT INTO events VALUES (?,?,?,?,?,?,?)`)
const insertStanding = db.prepare(`INSERT INTO standings (event_id,standing,player,character_name,deck_name,swiss_record) VALUES (?,?,?,?,?,?)`)
const insertCard     = db.prepare(`INSERT INTO deck_cards (standing_id,section,qty,card_name,cardeio_id,uvs_id) VALUES (?,?,?,?,?,?)`)
const insertMatch    = db.prepare(`INSERT INTO matches (standing_id,phase,round_label,opponent,opponent_character,result) VALUES (?,?,?,?,?,?)`)

// The majors markdown tables are | Rd | Opponent | Character | Result |, one
// column narrower than the regionals writer's (which carries a Deck ID column),
// so the result cell is index 3 rather than 4.
const RESULT_COL = 3

const ingest = db.transaction(() => {
  if (!fs.existsSync(majorsDir)) {
    console.error(`No majors/ directory at ${majorsDir} — run scripts/fetch-majors.mjs first.`)
    process.exit(1)
  }

  for (const folder of fs.readdirSync(majorsDir).sort()) {
    const eventDir = path.join(majorsDir, folder)
    const summaryPath = path.join(eventDir, 'SUMMARY.md')
    if (!fs.existsSync(summaryPath)) continue

    const ev = parseSummary(fs.readFileSync(summaryPath, 'utf8').replace(/^﻿/, ''))
    if (!ev.tier || !ev.season) {
      console.warn(`  WARN: ${folder} is missing Tier/Season metadata — skipping`)
      continue
    }
    insertEvent.run(folder, ev.name, ev.tier, ev.season, ev.location, ev.date, ev.playerCount)

    const files = fs.readdirSync(eventDir)
    for (const s of ev.standings) {
      const { lastInsertRowid: sid } = insertStanding.run(
        folder, s.standing, s.player, s.characterName, null, null
      )

      const prefix = String(s.standing).padStart(2, '0') + '-'
      const playerFile = files.find(f => f.startsWith(prefix) && f.endsWith('.md'))
      if (!playerFile) continue

      const p = parsePlayerFile(fs.readFileSync(path.join(eventDir, playerFile), 'utf8').replace(/^﻿/, ''))
      const characterFallback = s.characterName == null && p.character.length > 0
        ? p.character[0].name : null
      db.prepare(`UPDATE standings SET deck_name=?, swiss_record=?, character_name=COALESCE(character_name,?) WHERE id=?`)
        .run(p.deckName, p.swissRecord, characterFallback, sid)

      const insertCards = (section, list) => {
        for (const c of list) {
          const uvs = resolveUvsId({ name: c.name })
          const id = cardeioIdByName.get(normCardName(c.name)) ?? null
          // A missing canonical id means the card is absent from
          // src/assets/*.json; a missing cardeio_id just means it postdates the
          // legacy carde.io catalog.
          if (!uvs) unresolvedCards.add(c.name)
          insertCard.run(sid, section, c.qty, c.name, id, uvs)
        }
      }
      insertCards('character', p.character)
      insertCards('main',      p.mainDeck)
      insertCards('sideboard', p.sideboard)

      for (const row of p.swiss)  insertMatch.run(sid, 'swiss',  row[0], row[1] ?? null, row[2] ?? null, row[RESULT_COL] ?? null)
      for (const row of p.topCut) insertMatch.run(sid, 'topcut', row[0], row[1] ?? null, row[2] ?? null, row[RESULT_COL] ?? null)
    }
  }
})

ingest()

// Resolve opponent_standing by joining the opponent name back to standings in
// the same event, then take the opponent's character from that linked standing.
db.prepare(`
  UPDATE matches SET opponent_standing = (
    SELECT s2.standing
    FROM standings s1
    JOIN standings s2 ON s2.event_id = s1.event_id AND s2.player = matches.opponent
    WHERE s1.id = matches.standing_id
  )
`).run()

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
  SELECT e.id, e.name, e.tier, e.season, e.location, e.date,
         e.player_count AS playerCount,
         s.character_name AS winnerCharacter
  FROM events e
  LEFT JOIN standings s ON s.event_id = e.id AND s.standing = 1
  ORDER BY e.date
`).all()

const allStandings = db.prepare(`
  SELECT id, event_id AS eventId, standing, character_name AS characterName,
         deck_name AS deckName, swiss_record AS swissRecord
  FROM standings ORDER BY event_id, standing
`).all()

const allCards = db.prepare(`
  -- cardeio_id is deliberately NOT exported; see the matching note in
  -- gen-locals.mjs. uvs_id covers 100% of rows and supersedes it, and the Mongo
  -- OIDs were the largest field in a file Vite re-emits as an 11MB JS chunk.
  SELECT standing_id AS standingId, section, qty, card_name AS name, uvs_id AS uvsId
  FROM deck_cards ORDER BY standing_id, section, id
`).all()

const allMatches = db.prepare(`
  SELECT standing_id AS standingId, phase, round_label AS round,
         opponent_standing AS opponentStanding,
         opponent_character AS opponentCharacter, result
  FROM matches ORDER BY standing_id, phase, id
`).all()

// Exported standings are keyed by "<eventId>#<placing>" rather than the
// AUTOINCREMENT rowid — the rowid is positional, so one new event renumbers
// everything ingested after it and rewrites every shard. See gen-locals.mjs.
// `standingId` is also dropped from each row, since it duplicated its own key.
const keyById = new Map(allStandings.map(s => [s.id, `${s.eventId}#${s.standing}`]))
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
const matchesByStanding = groupByStanding(allMatches)

const standingsByEvent = {}
for (const s of allStandings) {
  const key = keyById.get(s.id)
  ;(standingsByEvent[s.eventId] ??= []).push({ ...s, id: key, hasDeck: (cardsByStanding[key]?.length ?? 0) > 0 })
}

// Sorted-key serialization so the bytes are a pure function of the data and not
// of SQL row order. See gen-locals.mjs.
const stableStringify = (value) => JSON.stringify(value, (_k, v) =>
  (v && typeof v === 'object' && !Array.isArray(v))
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))
    : v)

fs.writeFileSync(outIndex, stableStringify({ events, standings: standingsByEvent }))

// ── deck-data shards, one per season tab ────────────────────────────────────
const seasonOfEvent = new Map(events.map(e => [e.id, e.season]))
const shardOfStanding = new Map()
for (const [evId, list] of Object.entries(standingsByEvent)) {
  const season = seasonOfEvent.get(evId)
  for (const st of list) shardOfStanding.set(st.id, season)
}


const shards = {}
const bucket = k => (shards[k] ??= { cards: {}, matches: {} })
for (const [sid, rows] of Object.entries(cardsByStanding)) {
  const k = shardOfStanding.get(sid)
  if (k) bucket(k).cards[sid] = rows
}
for (const [sid, rows] of Object.entries(matchesByStanding)) {
  const k = shardOfStanding.get(sid)
  if (k) bucket(k).matches[sid] = rows
}

fs.rmSync(outShardDir, { recursive: true, force: true })
fs.mkdirSync(outShardDir, { recursive: true })
let shardBytes = 0
for (const [k, data] of Object.entries(shards)) {
  const file = path.join(outShardDir, `${k}.json`)
  fs.writeFileSync(file, stableStringify(data))
  shardBytes += fs.statSync(file).size
}

const idCoverage = db.prepare(`SELECT COUNT(*) AS total, SUM(uvs_id IS NOT NULL) AS resolved FROM deck_cards`).get()
console.log(`\ncanonical card ids: ${idCoverage.resolved}/${idCoverage.total} deck rows (${(100 * idCoverage.resolved / idCoverage.total).toFixed(1)}%)`)

if (unresolvedCards.size) {
  console.warn(`\nCards with no canonical id (${unresolvedCards.size}) — missing from src/assets/*.json:`)
  for (const name of [...unresolvedCards].sort()) console.warn(`  - ${name}`)
}

const stats = db.prepare(`
  SELECT (SELECT COUNT(*) FROM events)     AS events,
         (SELECT COUNT(*) FROM standings)  AS standings,
         (SELECT COUNT(*) FROM deck_cards) AS cards,
         (SELECT COUNT(*) FROM matches)    AS matches
`).get()
const bySeason = db.prepare(`SELECT season, COUNT(*) n FROM events GROUP BY season ORDER BY season`).all()

console.log(`\nmajors: ${stats.events} events, ${stats.standings} standings, ${stats.cards} cards, ${stats.matches} matches`)
console.log(bySeason.map(r => `  ${r.season}: ${r.n} events`).join('\n'))
console.log(`\nWrote ${path.relative(root, outIndex)}`)
console.log(`shards: ${Object.keys(shards).length} season files, ${Math.round(shardBytes / 1024)} KB → ${path.relative(root, outShardDir)}`)
