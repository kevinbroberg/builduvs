<script setup> 
  import Elements from 'components/cards/detail/Elements.vue'
  import {
      face,
      deck2clipboard,
      partitions,
      sorts,
      sortField,
      sortedDeck,
      
      increment,
      decrement,
      trash,
      clearFace,
      deckLoadDialog,
      
      partitionOptions,
      howPartition,
  } from './deck_logic'
</script>

<template>
  <q-btn-group push>
    
      <q-btn push stack dense round icon="file_upload" @click="deckLoadDialog">
        <q-tooltip>Load a deck from file or with text input</q-tooltip>
      </q-btn>
      <!-- <q-btn-dropdown menu-self="bottom middle" push stack auto-close 
        label="Sort" icon="sort">
        <q-item v-for="sort in sorts" v-bind:key="sort.label" clickable @click="sortField = sort">
          <q-item-label standout v-if='sortField == sort'>{{sort.label}}</q-item-label>
          <q-item-label v-else>{{sort.label}}</q-item-label>
        </q-item>
      </q-btn-dropdown> -->
      
      <q-btn-dropdown menu-self="bottom middle" push stack auto-close
        label="Partition" icon="group_work">
        <q-item v-for="partOpt in partitionOptions" v-bind:key="partOpt" clickable @click="howPartition = partOpt" :active="howPartition === partOpt" active-class="bg-orange-13">
          <q-item-label>{{partOpt}}</q-item-label>
        </q-item>
      </q-btn-dropdown>
      <q-btn push label="Copy" icon="content_copy" @click="deck2clipboard" >
        <q-tooltip>Copies your deck to clipboard</q-tooltip>
      </q-btn>
      <q-btn push label="Wipe" icon="delete" @click="trash" />
  </q-btn-group>

  <q-item-section avatar v-if="face">
      <q-avatar>
      <!-- TODO zoom into just the card art here -->
      <img :src="require(`assets/images/card_images/${face.asset}`)">
      </q-avatar>  
      <q-btn icon="clear" @click="clearFace" />
  </q-item-section>
  <q-item-section>
      <q-item-label lines="1" v-if="face">{{face.name}} <Elements :resources="face.resources" /></q-item-label>
  </q-item-section>

  <q-list bordered>
    <div v-for="partition in partitions" :key="partition.key">
      <q-separator/>
      <!-- <q-item-label v-if="howPartition == symbol" header><Elements :card=partition.cards[0].resources /></q-item-label> -->
      <q-item-label header>{{partition.label}}</q-item-label> <!-- v-else -->
      <q-item v-for="card in partition.cards" :key="card.asset" no-wrap dense :class="`card-list-${card.type}`">
        <q-item-section avatar v-ripple>
            <q-avatar square>
              <!-- TODO zoom into just the card art here -->
              <img
                :src="require(`assets/images/card_images/${card.asset}`)" @click="increment(card)" 
              />
              
            </q-avatar>  
        </q-item-section>
        <q-item-section>
            <q-item-label lines="2">
              <q-btn v-ripple flat round no-margin icon="remove" 
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
.card-list-side {
  background-color: #999999;
}
</style>
