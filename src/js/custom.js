// Custom cards: hosting a community project's fan-made cards on BuildUVS.
//
// Each project lives under its own path (/naruto) and, there, the whole app runs
// as a separate copy of itself: the router's base becomes that path (so every
// in-app link stays inside it), the card pool is the project's cards instead of
// UniVersus's (card_provider.js), and decks/settings persist under their own
// localStorage key (stores/index.js). The decision is made once per page load,
// from the URL, so the worlds can't leak into each other: the main site never
// links to a project, and the router can't navigate across the base — leaving
// is a full page load (MainLayout's "Back to BuildUVS").
//
// These are fan-made cards, not UniVersus product.
//
// Adding a project: generate its card JSON (see scripts/gen-custom-naruto.py),
// upload its art to R2, add an entry below, and a noindex rule in public/_headers.
// The key is the URL path segment, so it must not collide with a main-site route
// (cards, deck, lists, ...).
import naruto from 'assets/custom/naruto.json'

const PROJECTS = {
  naruto: { title: 'Naruto Cube', cards: naruto },
}

const segment = typeof window === 'undefined' ? '' : window.location.pathname.split('/')[1]

// The project this page load is running, or null on the main site.
export const custom = Object.hasOwn(PROJECTS, segment)
  ? { id: segment, base: `/${segment}`, ...PROJECTS[segment] }
  : null
