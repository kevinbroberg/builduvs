// Shared decklist → card-DB resolution, used by the /lists page (LocalsPage.vue)
// and the historical majors page (MajorsPage.vue).
//
// The two pages need different card pools. /lists shows current-format events, so
// restricting to standard-legal printings keeps lookups unambiguous. The majors
// page reaches back to 2024, where most of the field has since rotated out — only
// ~2.4k of ~9.9k printings are standard-legal, and staples like "Mop Strike" and
// "Foresight" are not among them — so it must resolve against every printing or
// roughly half of each historical decklist would fail to render.

import cardeioIdsData from 'src/assets/cardeio-ids.json'
import { cards as allCards } from 'src/js/card_provider.js'
import { normName, lookupKeys, buildNameIndex } from 'src/js/card_name_match'

export { normName }

/**
 * Build a resolver over a card pool.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.standardOnly=true]  Restrict to standard-legal printings.
 */
export function createCardResolver({ standardOnly = true } = {}) {
  const standardCards = allCards.filter(c => c.formats?.includes('standard'))
  const pool = standardOnly ? standardCards : allCards

  // When the pool spans every set, one name can hit several printings. Seed the
  // map with the whole pool, then let standard-legal printings win the exact
  // key, so a card still in rotation resolves to its current printing and
  // everything else falls back to whichever printing exists.
  //
  // buildNameIndex registers exact names first, then diacritic-folded aliases,
  // so an alias can never displace a real card ("Ryukyu (II)" must not claim
  // "ryukyu"). Variant-suffix stripping happens on the query side in findCard.
  const cardByName = buildNameIndex(pool)
  if (!standardOnly) for (const c of standardCards) cardByName.set(normName(c.name), c)

  // A deck card's cardeioId (assigned during ingest from cardeio-ids.json) shares
  // the card DB's own cardeio_id space. Key by both:
  //  - the cardeio-ids.json name-hop (legacy path, covers cards lacking a DB id), then
  //  - each card's own cardeio_id (authoritative; overrides the above), which joins
  //    directly and sidesteps deck↔DB name mismatches — diacritics ("Donny’s Bō
  //    Staff" vs "Bo"), stray quotes ('"I Would Like to Rage!"'), or a dropped word
  //    ("…the Star Razor").
  const cardByCardeioId = new Map(
    Object.entries(cardeioIdsData)
      .map(([name, data]) => [data.id, cardByName.get(normName(name))])
      .filter(([, card]) => card != null)
  )
  for (const c of pool) if (c.cardeio_id) cardByCardeioId.set(c.cardeio_id, c)

  function findCard(name) {
    if (!name) return null
    const n = normName(name)

    // 1. Exact, then the folded / variant-suffix-stripped forms
    for (const k of lookupKeys(name)) {
      const card = cardByName.get(k)
      if (card) return card
    }

    // 2. Flip card — try front side only (before " // ")
    if (n.includes(' // ')) {
      const front = n.split(' // ')[0].trim()
      for (const k of lookupKeys(front)) {
        const card = cardByName.get(k)
        if (card) return card
      }
    }

    // 3. Year subtitle — "Name, YYYY ..." → try just "Name"
    const yearStripped = n.replace(/,\s*\d{4}.*/, '').trim()
    if (yearStripped !== n) {
      const card = cardByName.get(yearStripped)
      if (card) return card
    }

    // 4. $ → s substitution ("Cardboard Crusader$" → "Cardboard Crusaders")
    if (n.includes('$')) {
      const card = cardByName.get(n.replaceAll('$', 's'))
      if (card) return card
    }

    return null
  }

  // Resolve one ingested deck row to a renderable card, preferring the direct
  // cardeio_id join and falling back to name matching.
  function resolveCard(dc) {
    const found = (dc.cardeioId && cardByCardeioId.get(dc.cardeioId)) || findCard(dc.name)
    return found
      ? { ...found, qty: dc.qty }
      : { name: dc.name, qty: dc.qty, asset: null, type: 'unknown' }
  }

  return { cardByName, cardByCardeioId, findCard, resolveCard }
}
