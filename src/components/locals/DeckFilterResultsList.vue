<script setup>
// The "matching decks" list DeckFilterBar's card-in-deck / main-character /
// element filters produce. Shared by LocalsPage's event-list view (results
// span several events, so each row names its event) and its single-event
// view (results are all the one event, so the event name would be noise —
// the deck name takes its place instead).
import { getCardImage } from 'src/js/image_helper'
import { eventName } from 'src/js/event_naming'
import ResourceSymbol from 'src/components/cards/detail/ResourceSymbol.vue'

const props = defineProps({
  results: { type: Array, required: true },  // standings joined with .event (see LocalsPage's deckFilterResults)
  filterCard: { type: Object, default: null }, // selected card, for the "N× Card Name" line
  showEventName: { type: Boolean, default: true }, // false on a single-event page — every row shares one event
  findCard: { type: Function, required: true },
  formatDate: { type: Function, required: true },
  playerLabel: { type: Function, required: true },
})

function rowClass(standing) {
  return {
    'row-winner': standing === 1,
    'row-top4': standing > 1 && standing <= 4,
    'row-top8': standing > 4 && standing <= 8,
  }
}
</script>

<template>
  <q-list separator>
    <q-item v-for="s in results" :key="`${s.event.id}-${s.standing}`"
      :class="rowClass(s.standing)"
      clickable :to="`/lists/${s.event.id}/${s.standing}`">
      <q-item-section avatar style="min-width: 52px">
        <div style="position: relative; display: inline-block">
          <q-avatar v-if="findCard(s.characterName)" square size="40px" class="standing-avatar">
            <img :src="getCardImage(findCard(s.characterName).asset)" class="card-thumb__img" />
          </q-avatar>
          <q-avatar v-else square size="40px" class="standing-avatar bg-grey-3" />
          <ResourceSymbol v-if="s.deckSymbol" :element="s.deckSymbol" class="standing-resource" />
        </div>
      </q-item-section>
      <q-item-section>
        <q-item-label>{{ playerLabel(s.characterName, s.standing) }}</q-item-label>
        <q-item-label v-if="showEventName" caption>
          {{ eventName(s.event) }} · {{ formatDate(s.event.date) }}<template v-if="s.deckName"> · {{ s.deckName }}</template>
        </q-item-label>
        <q-item-label v-else-if="s.deckName" caption>{{ s.deckName }}</q-item-label>
        <q-item-label v-if="filterCard" caption class="filter-match-line">{{ s.cardQty }}× {{ filterCard.name }}</q-item-label>
      </q-item-section>
      <q-item-section side v-if="s.overallRecord ?? s.swissRecord">
        <q-badge color="grey-6" :label="s.overallRecord ?? s.swissRecord" />
      </q-item-section>
      <q-item-section side>
        <q-icon name="chevron_right" color="grey-5" />
      </q-item-section>
    </q-item>
    <q-item v-if="!results.length">
      <q-item-section class="text-grey-6 text-center q-py-lg">
        No decks match these filters
      </q-item-section>
    </q-item>
  </q-list>
</template>

<style scoped>
.standing-avatar { overflow: hidden; }
.standing-avatar .card-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  transform: scale(1.4);
  transform-origin: top center;
}
.standing-resource {
  position: absolute;
  bottom: -2px;
  right: -2px;
  font-size: 18px;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
}

.filter-match-line { color: #c9530a; font-weight: 600; }

.row-winner { background: rgba(255, 190, 0, 0.12); }
.row-top4   { background: rgba(0, 170, 90, 0.07); }
.row-top8   { background: rgba(0, 90, 200, 0.04); }
</style>
