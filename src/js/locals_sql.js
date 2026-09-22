// Client-side sqlite for the /lists "card in deck" filter.
//
// gen-locals.mjs already builds a full relational locals.db (events / standings /
// deck_cards / matches) as a build-time intermediate on the way to the two JSON
// exports LocalsPage.vue reads. Rather than precomputing yet another bespoke
// card→decks JS index, we ship that same locals.db to the browser (public/locals.db,
// copied by gen-locals.mjs on every regen) and query it in place with sql.js
// (SQLite compiled to wasm). It's loaded lazily — only once the filter bar is
// actually opened — so the ~4MB db never costs anything on the common path.
//
// deck_cards has no deckSymbol/overallRecord columns (those are computed
// post-hoc into locals-index.json by compute-deck-symbols.mjs, not written back
// to the db), so this module only answers "which standings contain this card,
// and how many copies" — callers join that against the already-loaded
// locals-index.json for everything else (character, record, deckSymbol, event).

// Import the wasm binary's built URL explicitly (Vite's ?url asset handling)
// rather than relying on sql.js's own locateFile path resolution — under
// Vite's dependency pre-bundling, sql.js's default wasm URL gets rewritten to
// a dep-cache path that doesn't exist, 404ing silently past locateFile.
import initSqlJs from 'sql.js/dist/sql-wasm.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

let dbPromise = null

async function loadDb() {
  const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl })
  const buf = await fetch('/locals.db').then((r) => r.arrayBuffer())
  return new SQL.Database(new Uint8Array(buf))
}

function getDb() {
  if (!dbPromise) dbPromise = loadDb()
  return dbPromise
}

// Rows: { eventId, standing, qty }, one per standing that runs the card in the
// given deck sections. Matches by cardeio_id when known (stable across name
// variants/reprints), falling back to an exact card_name match for older rows
// lacking one.
//
// sections controls what "in deck" means for the caller's filter mode:
//  - ['character', 'main']: DeckFilterBar's "Card in deck" mode — sideboard-only
//    copies don't count.
//  - ['character']: "Main character" mode — the card must actually be the face
//    card, not just present somewhere in the 60/75.
async function findStandings({ cardeioId, cardName, sections }) {
  const db = await getDb()
  const placeholders = sections.map((_, i) => `$section${i}`).join(', ')
  const stmt = db.prepare(`
    SELECT s.event_id AS eventId, s.standing AS standing, SUM(dc.qty) AS qty
    FROM deck_cards dc
    JOIN standings s ON s.id = dc.standing_id
    WHERE dc.section IN (${placeholders})
      AND (dc.cardeio_id = $cardeioId OR (dc.cardeio_id IS NULL AND dc.card_name = $cardName))
    GROUP BY s.event_id, s.standing
  `)
  const bindings = { $cardeioId: cardeioId ?? null, $cardName: cardName ?? null }
  sections.forEach((s, i) => { bindings[`$section${i}`] = s })
  stmt.bind(bindings)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

export function findStandingsWithCard({ cardeioId, cardName }) {
  return findStandings({ cardeioId, cardName, sections: ['character', 'main'] })
}

export function findStandingsWithFaceCard({ cardeioId, cardName }) {
  return findStandings({ cardeioId, cardName, sections: ['character'] })
}

// Rows: { cardeioId, cardName, deckCount }, most-played first, scoped to
// eventIds (the active tab) and sections (deck-filter mode). Groups by
// cardeio_id when present; rows predating that column (cardeio_id IS NULL)
// fall back to grouping by card_name instead, so distinct unresolved cards
// don't get merged into one NULL bucket. deckCount is standings, not copies —
// a 4-of counts once, same denominator as the "N decks" summary line above.
//
// limit: null/omitted fetches every played card (still one cheap grouped
// query — a season's distinct card pool is a few hundred rows at most), so
// callers can attach a deckCount to typed search results too, not just the
// pre-typing "most played" list.
export async function getPopularCards({ sections, eventIds, limit = null }) {
  if (!eventIds.length) return []
  const db = await getDb()
  const sectionPh = sections.map((_, i) => `$section${i}`).join(', ')
  const eventPh = eventIds.map((_, i) => `$event${i}`).join(', ')
  const stmt = db.prepare(`
    SELECT dc.cardeio_id AS cardeioId, MAX(dc.card_name) AS cardName,
           COUNT(DISTINCT dc.standing_id) AS deckCount
    FROM deck_cards dc
    JOIN standings s ON s.id = dc.standing_id
    WHERE dc.section IN (${sectionPh}) AND s.event_id IN (${eventPh})
    GROUP BY COALESCE(dc.cardeio_id, dc.card_name)
    ORDER BY deckCount DESC
    LIMIT $limit
  `)
  const bindings = { $limit: limit ?? -1 } // sqlite: LIMIT -1 means unbounded
  sections.forEach((s, i) => { bindings[`$section${i}`] = s })
  eventIds.forEach((id, i) => { bindings[`$event${i}`] = id })
  stmt.bind(bindings)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}
