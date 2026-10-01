/**
 * Builds the public, analysis-ready tournament dataset under public/data/.
 *
 * The /lists and /majors pages read data shaped for the UI: a bundled index plus
 * one shard per tab, keyed and nested for fast rendering. That shape is awkward
 * to ask questions of. This script flattens the same data into a handful of tidy
 * tables (one row per event / deck / card-in-deck / match / card) so anyone can
 * hand them to the model or tool of their choice — upload the CSVs to Claude or
 * ChatGPT, open the SQLite file in DuckDB/Datasette, or load them in pandas —
 * and ask questions in plain language.
 *
 * Input is ONLY what is already committed and published (the index JSON, the
 * public deck-data shards and the card JSON), never the raw decklist markdown,
 * so nothing private leaks: player names are not in the inputs and so cannot be
 * in the outputs. It also means anyone with a checkout can rebuild it.
 *
 * Outputs (public/data/, committed and served at /data/):
 *   events.csv, decks.csv, deck_cards.csv, matches.csv, cards.csv
 *   README.md         — schema, caveats and example questions (written for LLMs too)
 *   schema.json       — machine-readable column list + row counts
 *
 * Plus data/builduvs.sqlite — the same five tables with indexes and two views,
 * for local poking (sqlite3, Datasette, DuckDB). It is ~28MB, so it is NOT
 * published or committed; the CSVs are the canonical published form, and are
 * line-oriented so adding an event diffs as just that event's rows.
 *
 * Usage: node scripts/gen-dataset.mjs   (gen-locals / gen-majors don't call this;
 * run it after either of them so the dataset matches what the site shows.)
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { uvsId, parseUvsId } from '../src/js/card_id.js'
import { eventName as localEventName, LC_FORMATS } from '../src/js/event_naming.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'data')
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(root, ...p), 'utf8'))

// ── Load ─────────────────────────────────────────────────────────────────────

const lcLabel = new Map(LC_FORMATS.map(f => [f.key, f.label]))

function loadCircuit(name) {
  const index = readJson('src', 'assets', `${name}-index.json`)
  const shardDir = path.join(root, 'public', 'deck-data', name)
  const cards = {}
  const matches = {}
  for (const f of fs.readdirSync(shardDir).filter(f => f.endsWith('.json')).sort()) {
    const shard = readJson('public', 'deck-data', name, f)
    Object.assign(cards, shard.cards)
    Object.assign(matches, shard.matches)
  }
  return { index, cards, matches }
}

const locals = loadCircuit('locals')
const majors = loadCircuit('majors')

// ── Tables ───────────────────────────────────────────────────────────────────

const events = []
for (const e of locals.index.events) {
  const isRegional = e.round === 0
  events.push({
    event_id: e.id,
    event_name: localEventName(e),
    date: e.date,
    location: e.location,
    player_count: e.playerCount,
    event_type: isRegional ? 'regional' : 'local_championship',
    lc_round: isRegional ? null : e.round,
    format_period: e.formatPeriod,
    format_label: lcLabel.get(e.formatPeriod) ?? null,
    season: null,
    source: 'locals',
  })
}
for (const e of majors.index.events) {
  events.push({
    event_id: e.id,
    event_name: e.name,
    date: e.date,
    location: e.location,
    player_count: e.playerCount,
    event_type: e.tier,
    lc_round: null,
    format_period: null,
    format_label: null,
    season: e.season,
    source: 'majors',
  })
}
events.sort((a, b) => a.date.localeCompare(b.date) || a.event_id.localeCompare(b.event_id))

// "5-1-1" → [5, 1, 1]. Records are W-L-D; a missing D means 0.
function parseRecord(rec) {
  const m = /^(\d+)-(\d+)(?:-(\d+))?$/.exec(String(rec || '').trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] || 0)] : [null, null, null]
}

// Character names are lowercase throughout the index except some Tekken 8
// entries ("Eddy Gordo"), and a few opponents are recorded as "—". Normalise
// both so `decks.character` and `matches.opponent_character` join cleanly.
const charName = n => (!n || n === '—') ? null : n.toLowerCase()

const decks = []
const deckCards = []
const matches = []
// A few events list the same placing more than once as empty placeholders (no
// character, no deck — e.g. several unplaced entrants at #999). Deck rows are
// keyed by that id, so the copies carry nothing; keep the first.
const seenDeckIds = new Set()
for (const src of [locals, majors]) {
  for (const list of Object.values(src.index.standings)) {
    for (const s of list) {
      if (seenDeckIds.has(s.id)) continue
      seenDeckIds.add(s.id)
      const rows = src.cards[s.id] ?? []
      const ms = src.matches[s.id] ?? []
      const [sw, sl, sd] = parseRecord(s.swissRecord)
      const [ow, ol, od] = parseRecord(s.overallRecord)
      const charCard = rows.find(r => r.section === 'character')
      decks.push({
        deck_id: s.id,
        event_id: s.eventId,
        standing: s.standing,
        character: charName(s.characterName),
        character_card_id: charCard?.uvsId ?? null,
        deck_name: s.deckName ?? null,
        deck_symbol: s.deckSymbol ?? null,
        swiss_record: s.swissRecord ?? null,
        swiss_wins: sw, swiss_losses: sl, swiss_draws: sd,
        overall_record: s.overallRecord ?? null,
        overall_wins: ow, overall_losses: ol, overall_draws: od,
        made_top_cut: ms.some(m => m.phase === 'topcut') ? 1 : 0,
        has_decklist: rows.length > 0 ? 1 : 0,
        main_deck_size: rows.filter(r => r.section === 'main').reduce((n, r) => n + r.qty, 0),
        sideboard_size: rows.filter(r => r.section === 'sideboard').reduce((n, r) => n + r.qty, 0),
      })
      for (const r of rows) {
        deckCards.push({
          deck_id: s.id,
          section: r.section,
          qty: r.qty,
          card_name: r.name,
          card_id: r.uvsId ?? null,
        })
      }
      for (const m of ms) {
        // "W 2-1" → result W, games 2-1. "BYE" → result BYE, no games.
        const mm = /^([WLD])\s+(\d+)-(\d+)$/.exec(String(m.result || '').trim())
        matches.push({
          deck_id: s.id,
          event_id: s.eventId,
          phase: m.phase,
          round: m.round,
          character: charName(s.characterName),
          opponent_deck_id: m.opponentStanding != null ? `${s.eventId}#${m.opponentStanding}` : null,
          opponent_character: charName(m.opponentCharacter),
          result: mm ? mm[1] : (m.result || null),
          games_won: mm ? Number(mm[2]) : null,
          games_lost: mm ? Number(mm[3]) : null,
        })
      }
    }
  }
}

// Cards: the same eleven files src/js/card_provider.js merges, in the same
// precedence order (first file wins on an id collision).
const CARD_FILES = ['tekken8', 'mha09', 'kaiju', 'teamhero', 'gg-critrole', 'sjw-mha4',
  'heroesclash', 'rampage_dlc', 'provs', 'rampage', 'cards']
const usedIds = new Set(deckCards.map(r => r.card_id).filter(Boolean))
const cardsById = new Map()
for (const file of CARD_FILES) {
  for (const c of readJson('src', 'assets', `${file}.json`)) {
    const asset = c.asset || `${c.extension_short}/${c.card_number_image}`
    const id = uvsId({ ...c, asset })
    if (!id || cardsById.has(id)) continue
    const join = v => (Array.isArray(v) ? v.join('|') : v ?? null)
    cardsById.set(id, {
      card_id: id,
      name: c.name,
      type: c.type ?? null,
      set_code: parseUvsId(id)?.set ?? null,
      set_name: c.extension ?? null,
      rarity: c.rarity ?? null,
      symbols: join(c.resources),
      keywords: join(c.keywords),
      difficulty: c.difficulty ?? null,
      control: c.control ?? null,
      block_zone: c.block_zone ?? null,
      block_modifier: c.block_modifier ?? null,
      speed: c.speed ?? null,
      damage: c.damage ?? null,
      attack_zone: c.attack_zone ?? null,
      hand_size: c.hand_size ?? null,
      vitality: c.vitality ?? null,
      deck_limit: c.limit ?? null,
      text: c.text ?? null,
      appears_in_decklists: usedIds.has(id) ? 1 : 0,
    })
  }
}
const cards = [...cardsById.values()].sort((a, b) => a.card_id.localeCompare(b.card_id))

// ── Write CSV ────────────────────────────────────────────────────────────────

const tables = { events, decks, deck_cards: deckCards, matches, cards }

function csvCell(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })
for (const [name, rows] of Object.entries(tables)) {
  const cols = Object.keys(rows[0])
  const lines = [cols.join(','), ...rows.map(r => cols.map(c => csvCell(r[c])).join(','))]
  fs.writeFileSync(path.join(outDir, `${name}.csv`), lines.join('\n') + '\n')
}

// ── Write SQLite ─────────────────────────────────────────────────────────────

const sqlType = (rows, col) => {
  const v = rows.find(r => r[col] !== null && r[col] !== undefined)?.[col]
  return typeof v === 'number' ? 'INTEGER' : 'TEXT'
}
const sqlitePath = path.join(root, 'data', 'builduvs.sqlite')
fs.mkdirSync(path.dirname(sqlitePath), { recursive: true })
if (fs.existsSync(sqlitePath)) fs.unlinkSync(sqlitePath)
const db = new Database(sqlitePath)
const PK = { events: 'event_id', decks: 'deck_id', cards: 'card_id' }
for (const [name, rows] of Object.entries(tables)) {
  const cols = Object.keys(rows[0])
  db.exec(`CREATE TABLE ${name} (${cols.map(c =>
    `${c} ${sqlType(rows, c)}${PK[name] === c ? ' PRIMARY KEY' : ''}`).join(', ')})`)
  const ins = db.prepare(`INSERT INTO ${name} VALUES (${cols.map(() => '?').join(',')})`)
  db.transaction(() => { for (const r of rows) ins.run(cols.map(c => r[c] ?? null)) })()
}
db.exec(`
  CREATE INDEX idx_decks_event      ON decks (event_id);
  CREATE INDEX idx_decks_character  ON decks (character);
  CREATE INDEX idx_deck_cards_deck  ON deck_cards (deck_id);
  CREATE INDEX idx_deck_cards_card  ON deck_cards (card_id, section);
  CREATE INDEX idx_matches_deck     ON matches (deck_id);
  CREATE INDEX idx_matches_chars    ON matches (character, opponent_character);

  -- Keep these two views in sync with the SQL shown in scripts/dataset-readme.md.
  CREATE VIEW deck_results AS
    SELECT d.*, e.event_name, e.date, e.event_type, e.format_period, e.season,
           e.player_count, e.location
    FROM decks d JOIN events e USING (event_id);

  CREATE VIEW matchups AS
    SELECT character, opponent_character,
           SUM(result = 'W') AS wins, SUM(result = 'L') AS losses, SUM(result = 'D') AS draws,
           COUNT(*) AS matches
    FROM matches
    WHERE result IN ('W','L','D') AND character IS NOT NULL AND opponent_character IS NOT NULL
    GROUP BY character, opponent_character;
`)
db.close()
console.log(`  sqlite (local only)  ${Math.round(fs.statSync(sqlitePath).size / 1024)} KB → ${path.relative(root, sqlitePath)}`)

// ── Write schema.json + README ───────────────────────────────────────────────

const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]))
const dateRange = [events[0].date, events[events.length - 1].date]
fs.writeFileSync(path.join(outDir, 'schema.json'), JSON.stringify({
  generated_from: 'https://github.com/kevinbroberg/builduvs (scripts/gen-dataset.mjs)',
  date_range: dateRange,
  row_counts: counts,
  tables: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, Object.keys(v[0])])),
}, null, 2) + '\n')

const readme = fs.readFileSync(path.join(root, 'scripts', 'dataset-readme.md'), 'utf8')
  .replace('{{DATE_RANGE}}', `${dateRange[0]} → ${dateRange[1]}`)
  .replace('{{COUNTS}}', Object.entries(counts).map(([k, n]) => `| \`${k}\` | ${n.toLocaleString('en-US')} |`).join('\n'))
fs.writeFileSync(path.join(outDir, 'README.md'), readme)

const unresolved = deckCards.filter(r => r.card_id && !cardsById.has(r.card_id)).length
console.log('dataset:', counts, `dates ${dateRange.join('..')}`)
if (unresolved) console.warn(`  ${unresolved} deck_cards rows reference a card_id missing from cards`)
for (const f of fs.readdirSync(outDir)) {
  console.log(`  ${f.padEnd(18)} ${Math.round(fs.statSync(path.join(outDir, f)).size / 1024)} KB`)
}
