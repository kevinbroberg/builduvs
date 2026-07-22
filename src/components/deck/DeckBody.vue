<script setup>
import { computed } from 'vue'
import { getCardImage } from 'src/js/image_helper'
import { useDeckStore } from 'src/stores/deck'
import DeckCardTile from 'src/components/cards/DeckCardTile.vue'

const SIDEKEY = 'sideboard'

const props = defineProps({
  // Pass pre-built partitions ({ key, label, cards }) OR raw deck/side lists.
  partitions: { type: Array, default: null },
  deckList: { type: Array, default: () => [] },
  sideList: { type: Array, default: () => [] },

  view: { type: String, default: 'tiles' }, // 'tiles' | 'list'
  columns: { type: Number, default: 8 },
  // editable = wired to the live deck store (add/remove/side, live quantity).
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['card-click'])

const store = useDeckStore()

// Build type-grouped partitions when explicit partitions weren't provided.
function partitionByType(deckList, sideList) {
  const typeMap = {}
  for (const card of deckList) {
    const t = card.type || 'unknown'
    ;(typeMap[t] ||= []).push(card)
  }
  const out = Object.entries(typeMap).map(([type, cards]) => ({
    key: type,
    label: `${type}: ${cards.reduce((sum, c) => sum + c.qty, 0)}`,
    cards,
  }))
  if (sideList?.length) {
    out.push({
      key: SIDEKEY,
      label: `Sideboard: ${sideList.reduce((sum, c) => sum + c.qty, 0)}`,
      cards: sideList.map(c => ({ ...c, type: SIDEKEY })),
    })
  }
  return out
}

const effectivePartitions = computed(
  () => props.partitions ?? partitionByType(props.deckList, props.sideList)
)

const gridStyle = computed(() => ({ gridTemplateColumns: `repeat(${props.columns}, 1fr)` }))

const isSide = partition => partition.key === SIDEKEY

// Live-store helpers for the editable list view.
function liveQty(card, side) {
  return side ? store.sideQuantity(card.asset) : store.quantity(card.asset)
}
function inc(card, side) {
  side ? store.incrementSide(card) : store.increment(card)
}
function dec(card, side) {
  side ? store.decrementSide(card) : store.decrement(card)
}
</script>

<template>
  <!-- ── Tiles view ─────────────────────────────────────────── -->
  <template v-if="view === 'tiles'">
    <div
      v-for="partition in effectivePartitions"
      :key="partition.key"
      class="deck-section"
      :class="{ 'deck-section--side': isSide(partition) }"
    >
      <div class="deck-section__label">{{ partition.label }}</div>
      <div class="deck-grid" :style="gridStyle">
        <DeckCardTile
          v-for="card in partition.cards"
          :key="card.asset"
          :card="card"
          :main="!isSide(partition)"
          :editable="editable"
          @card-click="emit('card-click', $event)"
        />
      </div>
    </div>
  </template>

  <!-- ── List view ──────────────────────────────────────────── -->
  <q-list v-else bordered class="deck-listview">
    <div
      v-for="partition in effectivePartitions"
      :key="partition.key"
      :class="{ 'deck-section--side': isSide(partition) }"
    >
      <q-separator />
      <q-item-label header>{{ partition.label }}</q-item-label>
      <q-item
        v-for="card in partition.cards"
        :key="card.asset"
        no-wrap
        dense
        clickable
        :class="`card-list-${card.type}`"
        @click="emit('card-click', card)"
      >
        <q-item-section avatar>
          <q-avatar square class="card-thumb">
            <img :src="getCardImage(card.asset)" class="card-thumb__img" :alt="card.name" />
          </q-avatar>
        </q-item-section>
        <q-item-section>
          <q-item-label lines="2">
            <span class="list-qty">{{ editable ? liveQty(card, isSide(partition)) : card.qty }}</span>
            {{ card.name }}
          </q-item-label>
        </q-item-section>
        <q-item-section v-if="editable" side @click.stop>
          <div class="row no-wrap items-center">
            <q-btn round dense size="sm" flat color="negative" icon="remove"
              @click="dec(card, isSide(partition))" />
            <q-btn round dense size="sm" flat color="positive" icon="add"
              @click="inc(card, isSide(partition))" />
          </div>
        </q-item-section>
      </q-item>
    </div>
  </q-list>
</template>

<style scoped>
.deck-section {
  margin-bottom: 20px;
}
.deck-section__label {
  color: inherit;
  opacity: 0.7;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.35);
}
.deck-section--side .deck-section__label {
  color: #d08700;
  opacity: 1;
}

/* Orderly rows of cards — column count is driven by the caller (inline style) */
.deck-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 14px;
}

.list-qty {
  display: inline-block;
  min-width: 1.4em;
  font-weight: 800;
  color: inherit;
}
.card-thumb {
  width: 34px;
  height: 34px;
}
.card-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
}
</style>
