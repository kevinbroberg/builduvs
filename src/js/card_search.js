// Card-name search shared by the card browser, the deck and tier quick adds, and
// Nerdle.
//
// Plain Fuse over the raw name ranked badly in two ways:
//
//   1. Punctuation counted as typos. "aki" vs "A.K.I., Mistress of Poison" is two
//      skipped dots in a three-letter query, which fell outside the threshold, so
//      the card never showed up while "Akimbo" and five "Taki"s did.
//   2. Everything came back in one blended fuzzy list, so a mid-word near-miss
//      could outrank the card whose name starts with what you typed.
//
// So names and queries both go through the same normalisation (searchKey), and
// results are ranked in tiers, the way most pickers do it:
//
//   0 exact             "aki mistress of poison"
//   1 name prefix       "aki"     → A.K.I., Mistress of Poison
//   2 word prefix       "poison"  → A.K.I., Mistress of Poison
//   3 word initials     "mop"     → Mistress Of Poison, "katbak" → KATsuki BAKugo
//   4 substring         "kugo"    → Katsuki Bakugo
//   5 fuzzy (Fuse)      "bakgo"   → Katsuki Bakugo, "hange zoe" → Danger Zone
//
// Scores are tier + a tiebreak in [0, 1), so lower is better and callers can
// sort on the number alone.

import Fuse from 'fuse.js'
import { normName, foldDiacritics } from 'src/js/card_name_match'

// Fuzzy matches come in two ways. When nothing else matched they're the typo
// fallback and show at once. Otherwise a few are tacked on behind the real
// matches, but only once typing pauses (callers wait FUZZY_DELAY_MS, then ask
// with `fuzzyExtras`), so they don't flicker in on every keystroke. Short
// queries match half the card pool within one error, so they never go fuzzy.
const FUZZY_MIN_LENGTH = 4
const FUZZY_EXTRAS = 5
export const FUZZY_DELAY_MS = 400

/**
 * Lowercase, accents folded, and punctuation handled the way a search analyzer's
 * word-delimiter step would: dots and apostrophes inside a word are dropped
 * ("A.K.I." → "aki", "Ken's" → "kens"), everything else separates words
 * ("Fu-Ma" → "fu ma", "More...Power..." → "more power"), and so does a letter
 * running into a digit (the "Ryu1"…"Ryu6" printings → "ryu 1").
 */
export function searchKey(s) {
  return foldDiacritics(normName(s))
    .replace(/æ/g, 'ae')
    .replace(/\.{2,}|…/g, ' ')
    .replace(/[.']/g, '')
    .replace(/([a-z])(?=\d)/g, '$1 ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Names repeat across reprints, and every index over any pool reuses these.
const entries = new Map()
function entryOf(name) {
  let e = entries.get(name)
  if (!e) {
    const key = searchKey(name)
    const words = key ? key.split(' ') : []
    e = { key, words, compact: words.join('') }
    entries.set(name, e)
  }
  return e
}

// Initials may hop over small words ("mistress poison" → Mistress of Poison),
// but past this many, "deku" would find DEstruction of the Cyber Lin KUei.
const MAX_SKIPS = 2

// Fewest words skipped to match q[i..] as prefixes of words[w..] in order, the
// first chunk starting exactly at words[w]. Infinity when there's no such split.
function chunksFrom(q, words, i, w) {
  const word = words[w]
  let k = 0
  while (k < word.length && i + k < q.length && word[k] === q[i + k]) k++
  if (i + k === q.length && k > 0) return 0
  // Longest prefix first; a shorter one only matters if the longer one strands
  // the rest of the query.
  for (; k >= 1; k--) {
    for (let j = w + 1; j < words.length && j - w - 1 <= MAX_SKIPS; j++) {
      const rest = chunksFrom(q, words, i + k, j)
      if (rest !== Infinity && j - w - 1 + rest <= MAX_SKIPS) return j - w - 1 + rest
    }
  }
  return Infinity
}

/**
 * Can `q` be split into prefixes of consecutive-ish words? "mop" → Mistress|Of|
 * Poison, "akimis" → AKI|MIStress, "katbak" → KATsuki|BAKugo. Words before the
 * first chunk are free; words skipped between chunks cost one each. Returns a
 * rank position (skips first, then where the match starts), or null.
 */
function initialsPos(q, words) {
  let best = null
  for (let w = 0; w < words.length; w++) {
    if (words[w][0] !== q[0]) continue
    const skips = chunksFrom(q, words, 0, w)
    if (skips !== Infinity) {
      const pos = skips * 10 + w
      if (best === null || pos < best) best = pos
      if (skips === 0) break
    }
  }
  return best
}

// Tiebreaks within a tier, packed below 1 so they never cross into the next:
// matching a whole word beats stopping mid-word ("aki" → A.K.I. before Akimbo),
// then earlier beats later, then shorter names beat longer.
const tiebreak = (pos, len, partial = false) =>
  (partial ? 0.5 : 0) + Math.min(pos, 49) / 100 + Math.min(len, 99) / 10000

// Does the match of q at `at` stop partway through a word?
const endsMidWord = (key, at, q) => at + q.length < key.length && key[at + q.length] !== ' '

function rank(e, q, qc) {
  const { key, compact, words } = e
  if (key === q || compact === qc) return 0
  if (key.startsWith(q)) return 1 + tiebreak(0, key.length, endsMidWord(key, 0, q))
  if (compact.startsWith(qc)) return 1 + tiebreak(0, key.length, true)
  const at = (' ' + key).indexOf(' ' + q)
  if (at >= 0) return 2 + tiebreak(at, key.length, endsMidWord(key, at, q))
  if (qc.length < 2) return null
  if (qc.length <= 24) {
    const pos = initialsPos(qc, words)
    if (pos !== null) return 3 + tiebreak(pos, key.length)
  }
  const sub = key.indexOf(q)
  if (sub >= 0) return 4 + tiebreak(sub, key.length)
  const csub = compact.indexOf(qc)
  if (csub >= 0) return 4 + tiebreak(csub, key.length)
  return null
}

/**
 * Index a pool of cards for name search. Cheap to build: per-name keys are
 * cached across indexes, and the Fuse index is only built the first time a
 * query needs the fuzzy fallback.
 *
 * @param {Array} cards
 * @param {(card:any)=>string} [nameOf]
 */
export function createCardSearch(cards, nameOf = c => c.name) {
  const pool = cards.map(item => ({ item, e: entryOf(nameOf(item) || '') }))
  let fuse = null

  /**
   * @param {string} query
   * @param {{limit?: number, fuzzyExtras?: boolean}} [opts] `limit` caps the
   *   regular matches; `fuzzyExtras` appends up to FUZZY_EXTRAS fuzzy ones after them
   * @returns {{item:any, score:number}[]} best first
   */
  function search(query, { limit, fuzzyExtras = false } = {}) {
    const q = searchKey(query)
    if (!q) return []
    const qc = q.replace(/ /g, '')

    const hits = []
    for (const { item, e } of pool) {
      const score = rank(e, q, qc)
      if (score !== null) hits.push({ item, score })
    }

    hits.sort((a, b) => a.score - b.score)
    const out = limit ? hits.slice(0, limit) : hits

    if (qc.length >= FUZZY_MIN_LENGTH && (hits.length === 0 || fuzzyExtras)) {
      fuse ??= new Fuse(pool, {
        keys: [{ name: 'key', getFn: p => p.e.key }],
        threshold: 0.35,
        ignoreLocation: true,
        includeScore: true,
      })
      const cap = hits.length ? FUZZY_EXTRAS : (limit ?? Infinity)
      const seen = new Set(hits.map(h => h.item))
      let added = 0
      for (const r of fuse.search(q)) {
        if (added >= cap) break
        if (seen.has(r.item.item)) continue
        out.push({ item: r.item.item, score: 5 + r.score })
        added++
      }
    }

    return out
  }

  return { search }
}
