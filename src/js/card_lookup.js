// Resolve whatever a decklist gives us — a vendor id, or just a name — to the
// canonical card id defined in card_id.js.
//
// Built by scripts/build-card-crosswalk.mjs into src/assets/card-crosswalk.json.
// Everything fuzzy happens there, offline, with a written report; this module is
// the thin runtime that reads the result. That split is the point: the pipelines
// used to re-derive their own name matching, each with a slightly different
// regex, and a card spelled with U+2019 instead of U+0027 ("Jin's Glove") fell
// through all of them at once.
//
// Resolution order, strongest evidence first:
//
//   1. Hydra UUID       — exact, from tabletop.gg deck payloads
//   2. carde.io id      — exact, from legacy carde.io deck payloads
//   3. name             — for the hand-edited decklist markdown, which stores
//                         names only; keys cover both vendor and our spellings
//
// Dependency-free, and takes the crosswalk as an argument rather than importing
// it, so Node scripts (fs.readFileSync) and the Vue app (bundler import) can
// both use it — same convention as cardeio_index.js and card_name_match.js.

// Fold the spellings that differ between vendors but mean the same card.
// U+2019 vs U+0027 is the one that broke /lists; the rest are the same class of
// problem found while fixing it.
export const norm = s => (s || '')
  .toLowerCase()
  .replace(/[‘’‚‛′`]/g, "'")
  .replace(/[“”„]/g, '"')
  .replace(/[–—]/g, '-')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const stripVariant = s => s.replace(/\s*\((?:i{1,3}|iv|vi{0,3}|ix|x)\)\s*$/, '').trim()
const frontFace = s => (s.includes(' // ') ? s.split(' // ')[0].trim() : s)

// "Jacob Johnson, 2019 UK National Champion" → "Jacob Johnson". Requires a
// four-digit year right after the comma, so ordinary subtitles ("Godzilla, King
// of the Monsters", "Pumat Sol, Magical Proprietor") are untouched. Tried late,
// after every exact form, so it can only ever rescue a name that already missed.
const stripYearSubtitle = s => s.replace(/,\s*\d{4}\b.*$/, '').trim()
// '&' and the word "and" are the same conjunction to everyone except a string
// compare: the card reads "Arrows & Daggers", decklists say "Arrows And Daggers".
// Fold it BEFORE punctuation is stripped — strip first and the '&' simply
// vanishes, leaving "arrowsdaggers" vs "arrowsanddaggers".
const squash = s => norm(s).replace(/\$/g, 's').replace(/&/g, ' and ').replace(/[^a-z0-9]/g, '')
const squashNoStop = s => squash(String(s || '').replace(/\b(?:the|a|an)\b/gi, ' '))

/**
 * Every key worth trying for one name, strongest first. Must stay in step with
 * the key set build-card-crosswalk.mjs registers, or lookups will miss keys the
 * table actually holds.
 */
export function nameKeys(name) {
  const n = norm(name)
  return [...new Set([
    n,
    stripVariant(n),
    frontFace(n),
    stripVariant(frontFace(n)),
    squash(name),
    squash(frontFace(name)),
    squashNoStop(name),
    squashNoStop(frontFace(name)),
    stripYearSubtitle(n),
    squash(stripYearSubtitle(n)),
  ].filter(Boolean))]
}

/**
 * @param {object} crosswalk parsed card-crosswalk.json
 * @returns {(ref: {hydraId?:string, cardeioId?:string, name?:string}) => string|null}
 */
export function buildResolver(crosswalk) {
  const { byHydraId = {}, byCardeioId = {}, byName = {} } = crosswalk || {}
  return function resolveUvsId({ hydraId, cardeioId, name } = {}) {
    if (hydraId && byHydraId[hydraId]) return byHydraId[hydraId]
    if (cardeioId && byCardeioId[cardeioId]) return byCardeioId[cardeioId]
    if (name) {
      for (const k of nameKeys(name)) {
        if (byName[k]) return byName[k]
      }
    }
    return null
  }
}
