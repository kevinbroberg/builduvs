<script setup>
// The deck's main symbol as a toggle button, for a search box's append slot:
// lit = results limited to cards the deck can play (see deck_playable.js).
import { useDeckPlayable } from 'src/js/deck_playable'
import ResourceSymbol from 'src/components/cards/detail/ResourceSymbol.vue'

const { symbolFilterOn, symbolFilterActive, mainSymbol, filterTip } = useDeckPlayable()
</script>

<template>
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

<style scoped>
/* Off: greyed out, so it's clear the search is unfiltered. */
.symbol-toggle--off {
  opacity: 0.35;
  filter: grayscale(1);
}
</style>
