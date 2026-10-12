<script setup>
import { ref, computed } from 'vue'
import Fuse from 'fuse.js'
import { cards } from 'src/js/card_provider'
import { useDeckStore } from 'src/stores/deck'
import { getCardImage } from 'src/js/image_helper'
import { baseSymbol, faceSymbolsOf, mainSymbolOf, isConfused } from 'src/js/deck_symbol'
import ResourceSymbol from 'src/components/cards/detail/ResourceSymbol.vue'

const props = defineProps({
  // Restrict the search pool to face characters (used by the empty-face state).
  charactersOnly: { type: Boolean, default: false },
  label: { type: String, default: 'Quick Add' },
})

const deckStore = useDeckStore()

// ----- Symbol filter --------------------------------------------------------
// Once there's a face, offer only cards the deck could play: the deck's main
// symbol (bare or attuned), any face symbol attuned, or the infinity wildcard.
// Until the main symbol is settled (empty or mixed deck), any face symbol counts.
// (Characters never reach this: see `pool`.)
const symbolFilterOn = ref(true)

const faceSyms = computed(() => faceSymbolsOf(deckStore.face))
const mainSymbol = computed(() => {
  const main = mainSymbolOf(deckStore.face, deckStore.getDeckList)
  return main && !isConfused(main) ? main : null
})
const symbolFilterActive = computed(() =>
  !props.charactersOnly && symbolFilterOn.value && faceSyms.value.length > 0)

function playable(card) {
  const bare = mainSymbol.value ? [mainSymbol.value] : faceSyms.value
  return (card.resources ?? []).some(r => r === 'infinity'
    || bare.includes(baseSymbol(r))
    || (r !== baseSymbol(r) && faceSyms.value.includes(baseSymbol(r))))
}

const filterTip = computed(() => {
  if (!symbolFilterActive.value) return 'Showing every card. Click to show only cards this deck can play.'
  const main = mainSymbol.value ?? faceSyms.value.join(' / ')
  return `Showing ${main} cards, attuned ${faceSyms.value.join(' / ')}, and infinity. Click to show every card.`
})

// Local index so quick-add searching never touches the card browser's filters.
// Characters are offered only while the deck has none: picking one then sets the
// face. Once there is a face, they're left out whether or not the symbol filter is on.
const pool = computed(() => {
  if (props.charactersOnly) return cards.filter(c => c.type === 'character')
  if (!deckStore.face) return cards
  const others = cards.filter(c => c.type !== 'character')
  return symbolFilterActive.value ? others.filter(playable) : others
})
const fuse = computed(() => new Fuse(pool.value, { keys: ['name'], threshold: 0.4 }))

const options = ref([])

function filterFn(val, update) {
  update(() => {
    const needle = val.trim()
    if (needle.length === 0) {
      options.value = []
    } else {
      options.value = fuse.value.search(needle, { limit: 20 }).map(r => r.item)
    }
  })
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
      <q-btn
        flat
        dense
        round
        size="sm"
        class="symbol-toggle"
        :class="{ 'symbol-toggle--off': !symbolFilterActive }"
        @click.stop="symbolFilterOn = !symbolFilterOn"
      >
        <ResourceSymbol v-if="mainSymbol" :element="mainSymbol" size="18px" />
        <q-icon v-else name="filter_alt" size="18px" />
        <q-tooltip>{{ filterTip }}</q-tooltip>
      </q-btn>
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
/* Off: greyed out, so it's clear the search is unfiltered. */
.symbol-toggle--off {
  opacity: 0.35;
  filter: grayscale(1);
}
</style>
