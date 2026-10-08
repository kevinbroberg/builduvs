// The sentinel a deck gets when its main symbol can't be determined.
//
// This used to be 'infinity', which was a bad choice: infinity is a REAL printed
// UVS resource (cards like "That Day" and "Vertical Maneuvering Equipment" are
// printed ["infinity"]), so an inconclusive deck was indistinguishable from a
// genuine infinity deck. 'confused' has no printed counterpart and renders as a
// question mark rather than a resource icon.
//
// Dependency-free so scripts/compute-deck-symbols.mjs can import it alongside
// the Vue components.

// Printed resource symbols. Alphabetical, matching card_provider.js's
// symbolOptions (the /cards search filter's own element list) — kept as a
// literal copy rather than importing that module, since this file is
// dependency-free so scripts/compute-deck-symbols.mjs (plain Node, no Vite/Vue)
// can import it too. Used by the /lists filter bar's element toggle row.
export const ALL_ELEMENTS = [
  'air', 'all', 'chaos', 'death', 'earth', 'evil',
  'fire', 'good', 'infinity', 'life', 'order', 'void', 'water',
]

export const CONFUSED_SYMBOL = 'confused'

export const isConfused = symbol =>
  String(symbol || '').toLowerCase() === CONFUSED_SYMBOL

// Human-readable label for a deck symbol (used in link previews and tooltips).
export const deckSymbolLabel = symbol =>
  isConfused(symbol) ? 'Mixed' : symbol

// ── Main-symbol scoring ───────────────────────────────────────────────────────
// Shared by scripts/compute-deck-symbols.mjs (which bakes deckSymbol into the
// /lists and /majors indexes) and the deck pages' summary panel (which needs it
// live for precons, where nothing is precomputed).

// 'infinity' is the wildcard resource — legal under any face — so it is never
// a deck's defining symbol. ('all', the gear, is an ordinary hard symbol.)
export const EXCLUDED_SYMBOLS = new Set(['infinity'])

// Resources are printed either bare ("evil") or attuned ("evil-attuned").
export const baseSymbol = r => r.replace(/-attuned$/, '')

export const faceSymbolsOf = card => [...new Set(
  (card?.resources ?? []).map(baseSymbol).filter(r => !EXCLUDED_SYMBOLS.has(r))
)]

/**
 * Matches a card's resources against the face's symbols.
 *
 * Attuned symbols DO match, so a card is recognised as linking through every
 * symbol it really shares with the face. But an attuned symbol is not evidence
 * of deck identity on its own: attuned cards slot into any deck, so a card
 * whose only link is attuned says nothing about the deck's main symbol.
 *
 * Returns Map<symbol, matchedViaBareSymbol>.
 */
export function faceMatches(resources, faceSet) {
  const matched = new Map()
  for (const r of resources) {
    if (EXCLUDED_SYMBOLS.has(r)) continue
    const base = baseSymbol(r)
    if (EXCLUDED_SYMBOLS.has(base) || !faceSet.has(base)) continue
    matched.set(base, (matched.get(base) ?? false) || base === r)
  }
  return matched
}

/**
 * For each face symbol, how many main-deck copies link to the face through
 * that symbol alone, printed bare. The symbol with such copies is the deck's
 * defining one; more than one means mixed hard symbols.
 *
 * `cards` are resolved cards carrying `resources` and `qty`; unresolved ones
 * (no resources) are skipped.
 */
export function singleLinkCounts(faceSyms, cards) {
  const faceSet = new Set(faceSyms)
  const counts = new Map(faceSyms.map(r => [r, 0]))
  for (const c of cards) {
    if (!c?.resources) continue
    const matched = faceMatches(c.resources, faceSet)
    if (matched.size !== 1) continue
    const [[symbol, viaBareSymbol]] = [...matched]
    if (!viaBareSymbol) continue
    counts.set(symbol, (counts.get(symbol) ?? 0) + (c.qty ?? 1))
  }
  return counts
}

/**
 * The deck's main symbol when no card is single-link evidence — typical of
 * faces with many symbols (Izuku Midoriya, On the Move has five), where every
 * multi-symbol card overlaps the face twice or more.
 *
 * A legal deck's one hard symbol is printed bare on every card that links to
 * the face through a bare symbol, so intersect those cards' bare face symbols:
 * Defiant Stance (air/life/good) and Godzilla vs Biollante (earth/life/water)
 * together leave only life. Attuned-only and off-pool cards say nothing and
 * are skipped. If several symbols survive, take the first in face order; if
 * none do (dirty data), fall back to the first face symbol printed anywhere.
 */
export function sharedBareSymbols(faceSyms, cards) {
  const faceSet = new Set(faceSyms)
  let candidates = null
  for (const c of cards) {
    if (!c?.resources) continue
    const bare = [...faceMatches(c.resources, faceSet)]
      .filter(([, viaBareSymbol]) => viaBareSymbol)
      .map(([symbol]) => symbol)
    if (!bare.length) continue
    candidates = (candidates ?? faceSyms).filter(r => bare.includes(r))
    if (!candidates.length) break
  }
  return candidates ?? []
}

export function fallbackSymbol(faceSyms, cards) {
  const candidates = sharedBareSymbols(faceSyms, cards)
  if (candidates.length) return candidates[0]
  const deckResources = new Set(cards.flatMap(c => c?.resources ?? []).map(baseSymbol))
  return faceSyms.find(r => deckResources.has(r)) ?? null
}

/**
 * A deck's main symbol from its face and resolved main-deck cards — the same
 * answer compute-deck-symbols.mjs gives for a known printing: the single
 * active single-link symbol; CONFUSED_SYMBOL when several are active; else
 * fallbackSymbol.
 */
export function mainSymbolOf(face, cards) {
  const syms = faceSymbolsOf(face)
  if (!syms.length) return null
  const counts = singleLinkCounts(syms, cards)
  const active = syms.filter(r => counts.get(r) > 0)
  if (active.length > 1) return CONFUSED_SYMBOL
  if (active.length === 1) return active[0]
  return fallbackSymbol(syms, cards)
}
