<script setup>
import { ref, computed } from 'vue'
import { cards } from 'src/js/card_provider'
import { createCardSearch, FUZZY_DELAY_MS } from 'src/js/card_search'
import { useDeckStore } from 'src/stores/deck'
import { getCardImage } from 'src/js/image_helper'
import { useDeckPlayable } from 'src/js/deck_playable'
import DeckSymbolToggle from 'src/components/deck/DeckSymbolToggle.vue'

const props = defineProps({
  // Restrict the search pool to face characters (used by the empty-face state).
  charactersOnly: { type: Boolean, default: false },
  label: { type: String, default: 'Quick Add' },
})

const deckStore = useDeckStore()

// ----- Symbol filter --------------------------------------------------------
// Once there's a face, offer only cards the deck could play (deck_playable.js).
// (Characters never reach this: see `pool`.)
const { faceSyms, symbolFilterActive, playable } = useDeckPlayable()

// Local index so quick-add searching never touches the card browser's filters.
// Characters are offered only while the deck has none: picking one then sets the
// face. Once there is a face, they're left out whether or not the symbol filter is on.
const pool = computed(() => {
  if (props.charactersOnly) return cards.filter(c => c.type === 'character')
  if (!deckStore.face) return cards
  const others = cards.filter(c => c.type !== 'character')
  return symbolFilterActive.value ? others.filter(playable) : others
})
const index = computed(() => createCardSearch(pool.value))

const options = ref([])
const find = (needle, fuzzyExtras) =>
  index.value.search(needle, { limit: 20, fuzzyExtras }).map(r => r.item)

// Fuzzy extras join the list once typing pauses.
let lateFuzzy = null
function filterFn(val, update) {
  clearTimeout(lateFuzzy)
  const needle = val.trim()
  update(() => {
    options.value = needle ? find(needle, false) : []
  })
  if (needle) lateFuzzy = setTimeout(() => { options.value = find(needle, true) }, FUZZY_DELAY_MS)
}

function onPick(card) {
  if (!card) return
  deckStore.increment(card)
}
</script>

<template>
  <q-select
    class="quick-add"
    dense
    outlined
    use-input
    hide-selected
    fill-input
    hide-dropdown-icon
    :model-value="null"
    :options="options"
    option-label="name"
    input-debounce="200"
    :label="label"
    placeholder="Search by name…"
    @filter="filterFn"
    @update:model-value="onPick"
  >
    <template v-slot:prepend>
      <q-icon name="search" />
    </template>

    <template v-if="!charactersOnly && faceSyms.length" v-slot:append>
      <DeckSymbolToggle />
    </template>

    <template v-slot:option="scope">
      <q-item v-bind="scope.itemProps">
        <q-item-section avatar>
          <q-img
            :src="getCardImage(scope.opt.asset)"
            :ratio="59 / 86"
            width="34px"
            fit="contain"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ scope.opt.name }}</q-item-label>
          <q-item-label caption>
            {{ scope.opt.type }} · {{ scope.opt.extension_short || scope.opt.extension }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </template>

    <template v-slot:no-option>
      <q-item>
        <q-item-section class="text-grey">No matches</q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<style scoped>
.quick-add {
  min-width: 220px;
}
</style>
