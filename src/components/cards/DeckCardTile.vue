<script setup>
import { getCardImage } from 'src/js/image_helper'
import { useDeckStore } from 'src/stores/deck'

const props = defineProps({
  card: Object,
  main: { type: Boolean, default: true },
})

const store = useDeckStore()

const mainActions = {
  increment: () => store.increment(props.card),
  decrement: () => store.decrement(props.card),
  side: () => store.send2Board(props.card),
  quantity: () => store.quantity(props.card.asset),
}
const sideActions = {
  increment: () => store.incrementSide(props.card),
  decrement: () => store.decrementSide(props.card),
  side: () => store.send2Main(props.card),
  quantity: () => store.sideQuantity(props.card.asset),
}

const actions = props.main ? mainActions : sideActions
const swapLabel = props.main ? 'Side' : 'Main'
</script>

<template>
  <div class="deck-tile">
    <q-img
      class="deck-tile__img"
      loading="lazy"
      fit="cover"
      :ratio="59 / 86"
      :src="getCardImage(card.asset)"
      :alt="card.name"
    />

    <!-- Bottom-middle quantity badge -->
    <div class="deck-tile__qty">{{ actions.quantity() || 0 }}</div>

    <!-- Hover controls -->
    <div class="deck-tile__actions">
      <q-btn round dense size="sm" color="positive" icon="add" @click="actions.increment()">
        <q-tooltip>Add copy</q-tooltip>
      </q-btn>
      <q-btn round dense size="sm" color="negative" icon="remove" @click="actions.decrement()">
        <q-tooltip>Remove copy</q-tooltip>
      </q-btn>
      <q-btn round dense size="sm" color="accent" icon="swap_horiz" @click="actions.side()">
        <q-tooltip>Move to {{ swapLabel }}</q-tooltip>
      </q-btn>
    </div>

    <q-tooltip anchor="top middle" self="bottom middle" :delay="400">{{ card.name }}</q-tooltip>
  </div>
</template>

<style scoped>
.deck-tile {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.deck-tile:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.6);
}
.deck-tile__img {
  display: block;
  width: 100%;
}

/* Circular quantity badge, bottom-middle */
.deck-tile__qty {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 26px;
  height: 26px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(15, 15, 20, 0.92);
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
  line-height: 1;
  border: 2px solid rgba(255, 255, 255, 0.85);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}

/* Hover action bar, top of card */
.deck-tile__actions {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 6px 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0));
  opacity: 0;
  transition: opacity 0.12s ease;
}
.deck-tile:hover .deck-tile__actions {
  opacity: 1;
}
</style>
