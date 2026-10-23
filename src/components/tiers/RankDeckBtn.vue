<script setup>
// "Rank" on a deck or event page: a plain link to the tier maker's setup with
// these cards (one entry each, in the order given) waiting unranked. A deck passes
// its character, main and side; an event, its standings' characters.
import { computed } from 'vue'
import { tierLink } from 'src/js/tier_file'

const props = defineProps({
  title: { type: String, default: '' },
  cards: { type: Array, required: true },
  tooltip: { type: String, default: "Open this deck's cards in the Tier Maker" },
})

const to = computed(() => tierLink(props.title, props.cards))
</script>

<template>
  <q-btn flat dense icon="leaderboard" size="sm" label="Rank" :to="to" :disable="!to.query.cards">
    <q-tooltip>{{ tooltip }}</q-tooltip>
  </q-btn>
</template>
