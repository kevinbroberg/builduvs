// Shared decklist → card-DB resolution, used by the /lists page (LocalsPage.vue)
// and the historical majors page (MajorsPage.vue).
//
// The two pages need different card pools. /lists shows current-format events, so
// restricting to standard-legal printings keeps lookups unambiguous. The majors
// page reaches back to 2024, where most of the field has since rotated out — only
// ~2.4k of ~9.9k printings are standard-legal, and staples like "Mop Strike" and
// "Foresight" are not among them — so it must resolve against every printing or
// roughly half of each historical decklist would fail to render.
//
// The resolver itself lives in card_resolver.js, free of app imports so node
// scripts can share it; this module binds it to the bundled card data.

import cardeioIdsData from 'src/assets/cardeio-ids.json'
import { cards as allCards, cardByUvsId } from 'src/js/card_provider.js'
import { normName } from 'src/js/card_name_match'
import { createCardResolverFrom } from 'src/js/card_resolver'

export { normName }

/**
 * Build a resolver over the app's card pool.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.standardOnly=true]  Restrict to standard-legal printings.
 */
export function createCardResolver({ standardOnly = true } = {}) {
  return createCardResolverFrom({ cards: allCards, cardByUvsId, cardeioIds: cardeioIdsData, standardOnly })
}
