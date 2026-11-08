// "Only cards my deck can play": the symbol toggle shared by the /deck quick-add
// and the navbar search. Once there's a face, playable means the deck's main
// symbol (bare or attuned), any face symbol attuned, or the infinity wildcard.
// Until the main symbol is settled (empty or mixed deck), any face symbol counts.
// The card must also be legal in the deck's format (deck store's `format`).
//
// The on/off state is module-level, so flipping it in one search box flips it in
// the other. Session-only, like the rest of the card browser's filters.
import { ref, computed } from 'vue'
import { useDeckStore } from 'src/stores/deck'
import { formatOf } from 'src/js/card_provider'
import { baseSymbol, faceSymbolsOf, mainSymbolOf, isConfused } from 'src/js/deck_symbol'
import { FORMAT_LABELS, fitsFormat } from 'src/js/formats'

const symbolFilterOn = ref(true)

export function useDeckPlayable() {
  const deckStore = useDeckStore()

  const faceSyms = computed(() => faceSymbolsOf(deckStore.face))
  const mainSymbol = computed(() => {
    const main = mainSymbolOf(deckStore.face, deckStore.getDeckList)
    return main && !isConfused(main) ? main : null
  })
  // On, and there's a face to filter by.
  const symbolFilterActive = computed(() => symbolFilterOn.value && faceSyms.value.length > 0)

  function playable(card) {
    if (deckStore.format && !fitsFormat(formatOf(card), deckStore.format)) return false
    const bare = mainSymbol.value ? [mainSymbol.value] : faceSyms.value
    return (card.resources ?? []).some(r => r === 'infinity'
      || bare.includes(baseSymbol(r))
      || (r !== baseSymbol(r) && faceSyms.value.includes(baseSymbol(r))))
  }

  const filterTip = computed(() => {
    if (!symbolFilterActive.value) return 'Showing every card. Click to show only cards this deck can play.'
    const main = mainSymbol.value ?? faceSyms.value.join(' / ')
    const format = deckStore.format && deckStore.format !== 'legacy'
      ? `${FORMAT_LABELS[deckStore.format]}-legal ` : ''
    return `Showing ${format}${main} cards, attuned ${faceSyms.value.join(' / ')}, and infinity. Click to show every card.`
  })

  return { symbolFilterOn, symbolFilterActive, faceSyms, mainSymbol, playable, filterTip }
}
