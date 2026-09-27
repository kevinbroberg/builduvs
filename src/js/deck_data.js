// Deck rows (cards + matches) for /lists and /majors, fetched per tab.
//
// ── What this replaced, and why ──────────────────────────────────────────────
// Deck data used to ship twice. Once as `locals-players.json`, imported by the
// page and therefore inlined by Vite into a 5.5MB JS chunk (majors' was 7.7MB);
// and again as `public/locals.db`, a 6.1MB SQLite file the card filter queried
// in the browser with sql.js. Both held the same 53,196 deck-card rows.
//
// That cost three things:
//   - the build. Vite parses imported JSON at build time, and those two chunks
//     are what ran Netlify out of heap.
//   - the visitor. Opening one ~3KB decklist downloaded every deck of every
//     event to find it.
//   - a 643KB wasm dependency, for queries that are a couple of loops.
//
// Now: one static JSON per tab under public/ (copied verbatim, never parsed at
// build time), fetched on demand, with the filter's aggregations done in plain
// JS over the shard already in memory. A tab shard is exactly the working set —
// the filter's scope is a single tab, and so is everything the page renders.
//
// Shard keys come from `shardKeyOf` in event_naming.js, the same function the
// generator uses to write the files, so reader and writer cannot drift.

/**
 * @param {object} index  the parsed locals-index.json / majors-index.json
 * @param {string} basePath  e.g. '/deck-data/locals'
 */
export function createDeckData({ index, basePath }) {
  // standing key → where that standing lives. Keys are "<eventId>#<placing>",
  // a natural key chosen so that adding an event cannot renumber existing ones
  // (see gen-locals.mjs). The filter answers in terms of event + placing, which
  // is what the index supplies.
  const locOf = new Map()
  for (const [eventId, list] of Object.entries(index.standings || {})) {
    for (const s of list) locOf.set(s.id, { eventId, standing: s.standing })
  }

  // shardKey → Promise<{cards, matches}>. Cached by key, so switching tabs back
  // and forth re-fetches nothing and the browser cache handles a reload.
  const inflight = new Map()

  function load(shardKey) {
    if (!shardKey) return Promise.resolve({ cards: {}, matches: {} })
    if (!inflight.has(shardKey)) {
      const p = fetch(`${basePath}/${encodeURIComponent(shardKey)}.json`)
        .then((r) => {
          // A tab with no decklists has no shard file; treat that as empty
          // rather than an error, so a new format period works before its first
          // event is recorded.
          if (r.status === 404) return { cards: {}, matches: {} }
          if (!r.ok) throw new Error(`deck-data ${shardKey}: HTTP ${r.status}`)
          return r.json()
        })
        .catch((err) => {
          // Don't cache a failure — a transient network error should be
          // retryable by simply revisiting the tab.
          inflight.delete(shardKey)
          throw err
        })
      inflight.set(shardKey, p)
    }
    return inflight.get(shardKey)
  }

  // ── filter queries, over an already-loaded shard ───────────────────────────
  // `sections` is what "in deck" means to the caller: ['character','main'] for
  // the card filter (a sideboard-only copy doesn't count), ['character'] for
  // "main character" mode.

  /** Rows: { eventId, standing, qty } — one per standing running the card. */
  function findStandings(shard, { uvsId, cardName, sections }) {
    const want = new Set(sections)
    const out = []
    for (const [sid, rows] of Object.entries(shard.cards)) {
      let qty = 0
      for (const r of rows) {
        if (!want.has(r.section)) continue
        // uvs_id is the canonical join and covers every row. cardName is a
        // fallback for a shard generated before the id existed.
        if (uvsId ? r.uvsId === uvsId : r.name === cardName) qty += r.qty
      }
      if (!qty) continue
      const loc = locOf.get(sid)
      if (loc) out.push({ ...loc, qty })
    }
    return out
  }

  /**
   * Rows: { uvsId, cardName, deckCount }, most-played first. deckCount counts
   * standings, not copies — a 4-of counts once, the same denominator as the
   * "N decks" line above the filter.
   *
   * Grouped by canonical id so reprints of one card collapse into a single row;
   * rows without one fall back to grouping by name, so distinct unresolved cards
   * don't merge into one bucket.
   */
  function popularCards(shard, { sections, eventIds }) {
    const want = new Set(sections)
    const scope = eventIds ? new Set(eventIds) : null
    const agg = new Map()
    for (const [sid, rows] of Object.entries(shard.cards)) {
      const loc = locOf.get(sid)
      if (!loc || (scope && !scope.has(loc.eventId))) continue
      // One standing contributes at most once per card, however many copies.
      const seen = new Set()
      for (const r of rows) {
        if (!want.has(r.section)) continue
        const key = r.uvsId || r.name
        if (seen.has(key)) continue
        seen.add(key)
        const hit = agg.get(key)
        if (hit) hit.deckCount++
        else agg.set(key, { uvsId: r.uvsId ?? null, cardName: r.name, deckCount: 1 })
      }
    }
    return [...agg.values()].sort((a, b) => b.deckCount - a.deckCount)
  }

  return {
    load,
    cardsFor: (shard, standingId) => shard?.cards?.[standingId] || [],
    matchesFor: (shard, standingId) => shard?.matches?.[standingId] || [],
    findStandings,
    popularCards,
  }
}
