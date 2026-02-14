<script setup>
import CardCard from 'src/components/cards/CardCard.vue'
import UltraCardDetail from 'src/components/cards/UltraCardDetail.vue'
import DeckDialog from 'components/deck/DeckDialog.vue'

import {
  face,
  deck2clipboard,
  partitions,

  trash,
  clearFace,
  SIDEKEY,
  partitionOptions,
  howPartition,
} from 'components/deck/deck_logic'
</script>

<template>
  <q-btn-group push>
    <DeckDialog />

    <q-btn-dropdown
      menu-self="bottom middle"
      push
      stack
      auto-close
      label="Partition"
      icon="group_work"
    >
      <q-item
        v-for="partOpt in partitionOptions"
        v-bind:key="partOpt"
        clickable
        @click="howPartition = partOpt"
        :active="howPartition === partOpt"
        active-class="bg-orange-13"
      >
        <q-item-label>{{ partOpt }}</q-item-label>
      </q-item>
    </q-btn-dropdown>
    <q-btn push label="Copy" icon="content_copy" @click="deck2clipboard">
      <q-tooltip>Copies your deck to clipboard</q-tooltip>
    </q-btn>
    <q-btn push label="Wipe" icon="delete" @click="trash" />
  </q-btn-group>

  <div class="row items-start q-gutter-md">
    <div center row v-if="face">
      <UltraCardDetail :card="face" />
    </div>
    <q-separator />
    <!-- <CardCard v-for="card in deck" v-bind:key="card?.name" :card="card" :main="true" /> -->
  </div>

    <!-- <div v-for="partition in partitions" :key="partition.key">
      <q-separator/>
      <q-item-label header>{{partition.label}}</q-item-label>
      <q-item v-for="card in partition.cards" :key="card.asset" no-wrap dense :class="`card-list-${card.type}`">
       
            <q-item-label lines="2">
              <q-btn v-ripple flat round no-margin icon="remove" 
                @click="decrement(card)"/>
              {{card.qty}} {{card.name}}
            </q-item-label>      
      </q-item>
    </div> -->
    
  <div v-for="partition in partitions" :key="partition.key" >
    <h3 header>{{partition.label}}</h3>
    <q-separator/>
    <div class="row items-start">
      <CardCard v-for="card in partition.cards" :key="card.asset" 
        :card="card" :main="partition.key != SIDEKEY" :class="'col-lg-2 col-md-3 col-sm-6 col-xs-12'" />
    </div>

  </div>
<!-- 
  <h3>Sideboard</h3>
  <div class="row items-start q-gutter-md">
    <CardCard v-for="card in side" v-bind:key="card?.name" :card="card" :main="false" />
  </div> -->
</template>