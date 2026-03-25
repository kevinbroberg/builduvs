<script setup>
  import ManySymbols from 'components/cards/detail/ManySymbols.vue'
  import DeckDialog from './DeckDialog.vue'
  import { useQuasar } from 'quasar'

  import { useDeckStore } from "src/stores/deck";
  import { storeToRefs } from "pinia";

  const $q = useQuasar()
  import { getCardImage } from 'src/js/image_helper'
  import {
      face,
      partitions,
      
      increment,
      decrement,
      clearFace,
      
  } from './deck_logic'

  const { hasDeck } = storeToRefs(useDeckStore());
</script>

<template>
  <q-btn-group push v-if="!hasDeck">
    <!-- TODO - formerly a button group with all the options -->
      <DeckDialog  />
  </q-btn-group>

  <q-item-section avatar v-if="face">
      <q-avatar>
      <!-- TODO zoom into just the card art here -->
      <img :src="getCardImage(face.asset)">
      </q-avatar>  
      <q-btn icon="clear" @click="clearFace" />
  </q-item-section>
  <q-item-section>
      <q-item-label lines="1" v-if="face">{{face.name}} <ManySymbols :resources="face.resources" /></q-item-label>
  </q-item-section>

  <q-list bordered>
    <div v-for="partition in partitions" :key="partition.key">
      <q-separator/>
      <!-- <q-item-label v-if="howPartition == symbol" header><ManySymbols :card=partition.cards[0].resources /></q-item-label> -->
      <q-item-label header>{{partition.label}}</q-item-label> <!-- v-else -->
      <q-item v-for="card in partition.cards" :key="card.asset" no-wrap dense :class="`card-list-${card.type}`">
        <q-item-section avatar>
            <q-avatar square class="card-thumb" @click="increment(card)">
              <img :src="getCardImage(card.asset)" class="card-thumb__img" />
            </q-avatar>
        </q-item-section>
        <q-item-section>
            <q-item-label lines="2">
              <q-btn flat round no-margin icon="remove" class="decrement-btn"
                @click="decrement(card)"/>
              {{card.qty}} {{card.name}}
            </q-item-label>            
        </q-item-section>
      </q-item>
    </div>
  </q-list>
</template>

<style>
.card-list-character {
  background-color: #f51a1a;
}
.card-list-foundation {
  background-color: #b6a7a0;
}
.card-list-attack {
  background-color: #d25421;
}
.card-list-asset {
  background-color: #a3bf75;
}
.card-list-action {
  background-color: #0b64cf;
}
.card-list-backup {
  background-color: #7b3fa0;
}
.card-list-side {
  background-color: #999999;
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
.card-thumb {
  cursor: pointer;
  overflow: hidden;
  transition: brightness 0.15s;
}
.card-thumb:hover {
  filter: brightness(1.15);
}
.card-thumb:active {
  filter: brightness(0.85);
}
.card-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  transform: scale(1.2);
  transform-origin: top center;
}
</style>
