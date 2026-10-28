<script setup>
// Add Cards: the full card search in a maximized dialog, so you can build
// without leaving the deck.
import { computed } from 'vue'
import { useDeckStore } from 'src/stores/deck'
import Filters from 'components/filter/Filters.vue'
import InfiniteScrollCardDetailList from 'components/cards/InfiniteScrollCardDetailList.vue'

const open = defineModel({ type: Boolean, default: false })

const deckStore = useDeckStore()
const deckSize = computed(() =>
  deckStore.getDeckList.reduce((n, c) => n + c.qty, 0) + (deckStore.face ? 1 : 0)
)
</script>

<template>
  <q-dialog v-model="open" maximized transition-show="slide-up" transition-hide="slide-down">
    <q-card>
      <q-toolbar class="bg-secondary text-white">
        <q-icon name="search" size="sm" class="q-mr-sm" />
        <q-toolbar-title>Add Cards</q-toolbar-title>
        <div class="text-caption q-mr-md">Deck size: {{ deckSize }}</div>
        <q-btn flat round dense icon="close" v-close-popup />
      </q-toolbar>
      <q-card-section class="scroll" style="max-height: calc(100vh - 50px)">
        <Filters />
        <InfiniteScrollCardDetailList />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
