<script setup>
  import ManySymbols from 'components/cards/detail/ManySymbols.vue'
  import DeckDialog from './DeckDialog.vue'
  import DeckSummary from './DeckSummary.vue'
  import { useQuasar } from 'quasar'

  import { useDeckStore } from "src/stores/deck";
  import { storeToRefs } from "pinia";

  const $q = useQuasar()
  import { getCardImage } from 'src/js/image_helper'
  import {
      face,
      deck,
      partitions,

      increment,
      decrement,
      clearFace,
      SIDEKEY,
      MAYBEKEY,
  } from './deck_logic'

  const deckStore = useDeckStore()
  const { hasDeck } = storeToRefs(deckStore)

  // Which board's +/- a row's buttons drive, by the group it's listed under.
  const boardOps = partition =>
    partition.key === SIDEKEY ? { inc: deckStore.incrementSide, dec: deckStore.decrementSide }
    : partition.key === MAYBEKEY ? { inc: deckStore.incrementMaybe, dec: deckStore.decrementMaybe }
    : { inc: increment, dec: decrement }
</script>

<template>
  <q-btn-group push v-if="!hasDeck">
    <!-- TODO - formerly a button group with all the options -->
      <DeckDialog  />
  </q-btn-group>

  <div v-if="face || deck.length" class="deck-view__header">
    <div v-if="face" class="deck-view__face">
      <q-avatar square class="card-thumb">
        <!-- TODO zoom into just the card art here -->
        <img :src="getCardImage(face.asset)" class="card-thumb__img">
      </q-avatar>
      <div class="deck-view__face-text">
        <div class="deck-view__face-name ellipsis">{{ face.name }}</div>
        <ManySymbols :resources="face.resources" />
      </div>
      <q-btn flat round dense icon="clear" @click="clearFace">
        <q-tooltip>Remove character</q-tooltip>
      </q-btn>
    </div>
    <DeckSummary light :face="face" :cards="deck" />
  </div>

  <q-list bordered>
    <div v-for="partition in partitions" :key="partition.key">
      <q-separator/>
      <!-- <q-item-label v-if="howPartition == symbol" header><ManySymbols :card=partition.cards[0].resources /></q-item-label> -->
      <q-item-label header>{{partition.label}}</q-item-label> <!-- v-else -->
      <q-item v-for="card in partition.cards" :key="card.asset" no-wrap dense
        :class="partition.key === SIDEKEY || partition.key === MAYBEKEY ? 'card-list-side' : `card-list-${card.type}`">
        <q-item-section avatar>
            <q-avatar square class="card-thumb" @click="boardOps(partition).inc(card)">
              <img :src="getCardImage(card.asset)" class="card-thumb__img" />
            </q-avatar>
        </q-item-section>
        <q-item-section>
            <q-item-label lines="2">
              <q-btn flat round no-margin icon="remove" class="decrement-btn"
                @click="boardOps(partition).dec(card)"/>
              {{card.qty}} {{card.name}}
            </q-item-label>            
        </q-item-section>
      </q-item>
    </div>
  </q-list>
</template>

<!-- Shared card-list / card-thumb styles now live in src/css/app.sass (global). -->
<style scoped>
.deck-view__header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
}
.deck-view__face {
  display: flex;
  align-items: center;
  gap: 10px;
}
.deck-view__face-text {
  flex: 1;
  min-width: 0;
}
.deck-view__face-name {
  font-weight: 700;
}
.decrement-btn {
  cursor: pointer;
  transition: filter 0.15s;
}
.decrement-btn:hover {
  filter: brightness(1.15);
}
.decrement-btn:active {
  filter: brightness(0.85);
}
</style>
