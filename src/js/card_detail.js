// Opening cards from anywhere: the card-detail popup (CardDetailDialog, mounted
// once in MainLayout) and the card browser.
import { shallowRef } from 'vue'
import { cards, cardByAsset, cardByUvsId, selections, formatCards, initializeSelections } from 'src/js/card_provider'
import { parseUvsId, formatUvsId } from 'src/js/card_id'

// The card the popup is showing, or null when it's closed. Shallow so this is the
// record itself rather than a reactive proxy, which wouldn't compare equal to it.
export const detailCard = shallowRef(null)

// Callers often hold a copy rather than the card itself (deck entries are
// `{ ...card, qty }`), so map back to the canonical record by asset.
export function openCardDetail(card) {
  if (card) detailCard.value = cardByAsset.get(card.asset) ?? card
}

export function closeCardDetail() {
  detailCard.value = null
}

// A card's own link: uvs_id "tk802-049" is /cards/tk802/049. Set codes never
// contain a hyphen, so the first one is always the set/number split.
export const cardPath = card => `/cards/${card.uvs_id.replace('-', '/')}`

// The reverse, going through the id helpers so a hand-typed /cards/TK802/49 works.
export function cardFromPath(set, number) {
  const id = parseUvsId(`${set}-${number}`)
  return (id && cardByUvsId.get(formatUvsId(id))) || null
}

// Every printing of a card: same name, newest set first (the card files are
// loaded newest first).
let byName = null
export function printingsOf(card) {
  if (!byName) {
    byName = new Map()
    for (const c of cards) {
      if (!byName.has(c.name)) byName.set(c.name, [])
      byName.get(c.name).push(c)
    }
  }
  return byName.get(card.name) ?? [card]
}

/**
 * Open the card browser on a name search. The browser's other filters are
 * reset first, since a leftover symbol or type filter could hide what was just
 * searched for; the format filter survives a reset, so it's dropped when it
 * would hide `card`.
 */
export function showInCardBrowser(router, name, card = null) {
  initializeSelections()
  if (card && !formatCards.value.includes(card)) selections.value.formats = []
  selections.value.name = name
  if (router.currentRoute.value.path !== '/cards') router.push('/cards')
}
