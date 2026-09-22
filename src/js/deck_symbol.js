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
