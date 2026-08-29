// Card-name normalization shared by everything that joins decklist card names
// back to the card database: the app pages (via decklist_cards.js) and the node
// build scripts (compute-deck-symbols.mjs, gen-preview-manifest.mjs).
//
// Dependency-free on purpose — the node scripts import it directly, so it must
// not pull in Vue, Fuse, or any asset JSON.
//
// Two mismatches recur between carde.io's names and our card data:
//
//   1. Variant suffixes. carde.io disambiguates repeated characters with a
//      roman numeral — "Mimic (I)", "Tamaki Amajiki (I)", "Mt. Lady (II)" —
//      that our card files don't carry ("Mimic", "Tamaki Amajiki"). Note this
//      suffix only ever appears in cardeio-ids.json and the generated indexes,
//      never in the card JSON itself.
//   2. Diacritics. Deck data has "Hange Zoë"; sjw-mha4.json has "Hange Zoe".
//
// Both are handled by registering each card under a set of alias keys and
// trying a matching set of query keys, so lookups succeed in either direction
// without exact matches ever changing behaviour.

// Normalize apostrophes and other quote variants to a plain straight apostrophe.
export const normName = name => (name || '').toLowerCase().replace(/[‘’‚‛′]/g, "'")

// "Hange Zoë" → "hange zoe"
export const foldDiacritics = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

// "mimic (i)" → "mimic". Only strips a trailing roman numeral in parentheses,
// so real parenthetical titles are left alone.
export const stripVariantSuffix = s =>
  s.replace(/\s*\((?:i{1,3}|iv|vi{0,3}|ix|x)\)\s*$/, '').trim()

const uniq = arr => [...new Set(arr.filter(Boolean))]

/**
 * Keys to try for a QUERY name, in priority order: exact first, then the
 * progressively more forgiving forms. This is where the variant suffix gets
 * stripped — "mimic (i)" falls back to "mimic".
 */
export function lookupKeys(name) {
  const n = normName(name)
  return uniq([n, stripVariantSuffix(n), foldDiacritics(n), foldDiacritics(stripVariantSuffix(n))])
}

/**
 * Build a name→card Map from a pool, in three ordered passes:
 *
 *   1. every card under its exact normalized name (first write wins)
 *   2. diacritic-folded aliases      — only for keys still unclaimed
 *   3. variant-suffix-stripped aliases — only for keys still unclaimed
 *
 * The pass ORDER is the whole point. Aliasing must never displace a real card
 * name: the database contains both "Ryukyu" (earth/life/all) and "Ryukyu (II)"
 * (air/earth/order), and registering aliases card-by-card let "Ryukyu (II)"
 * claim the key "ryukyu" — silently scoring decks against the wrong card's
 * symbols. Running all exact names first makes that impossible.
 *
 * Pass 3 still earns its place: when a pool contains only suffixed printings
 * (the standard-legal set has "Himiko Toga (III)" but no plain "Himiko Toga"),
 * a deck listing the plain name would otherwise not resolve at all. Because the
 * key is unclaimed in that case, filling it is safe. Where several variants
 * compete for one unclaimed key the first in pool order wins, which is
 * arbitrary but only ever applies when no exact card exists.
 *
 * @param {Iterable} cards
 * @param {(card:any)=>string} nameOf
 * @param {Map} [into] existing map to populate
 */
export function buildNameIndex(cards, nameOf = c => c.name, into = new Map()) {
  const list = [...cards]
  const addPass = keyOf => {
    for (const c of list) {
      const k = keyOf(normName(nameOf(c)))
      if (k && !into.has(k)) into.set(k, c)
    }
  }
  addPass(n => n)
  addPass(foldDiacritics)
  addPass(n => stripVariantSuffix(n))
  addPass(n => foldDiacritics(stripVariantSuffix(n)))
  return into
}
