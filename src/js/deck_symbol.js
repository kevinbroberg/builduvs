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

export const CONFUSED_SYMBOL = 'confused'

export const isConfused = symbol =>
  String(symbol || '').toLowerCase() === CONFUSED_SYMBOL

// Human-readable label for a deck symbol (used in link previews and tooltips).
export const deckSymbolLabel = symbol =>
  isConfused(symbol) ? 'Mixed' : symbol
