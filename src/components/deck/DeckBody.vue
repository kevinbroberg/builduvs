<script setup>
import { computed } from 'vue'
import { getCardImage } from 'src/js/image_helper'
import { useDeckStore } from 'src/stores/deck'
import DeckCardTile from 'src/components/cards/DeckCardTile.vue'

const SIDEKEY = 'sideboard'
const MAYBEKEY = 'maybeboard'
const FACEKEY = 'face'

const props = defineProps({
  // Pass pre-built partitions ({ key, label, cards }) OR raw deck/side lists.
  partitions: { type: Array, default: null },
  // Face character(s), shown as their own section between the main deck and
  // the sideboard (precons can ship two or three).
  faceList: { type: Array, default: () => [] },
  deckList: { type: Array, default: () => [] },
  sideList: { type: Array, default: () => [] },

  view: { type: String, default: 'tiles' }, // 'tiles' | 'list'
  columns: { type: Number, default: 8 },
  // editable = wired to the live deck store (add/remove/side, live quantity).
  editable: { type: Boolean, default: false },
  // Optional useCardDrag() instance (src/js/card_drag.js). When set, cards drag
  // between the boards: 'main', 'side' and 'maybe'.
  drag: { type: Object, default: null },
})
const emit = defineEmits(['card-click'])

const store = useDeckStore()

// Build type-grouped partitions when explicit partitions weren't provided.
function partitionByType(faceList, deckList, sideList) {
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
  // Faces sit after the main deck, not first: the stage already opens on the
  // (first) face, so this section is for flipping back to it, or between
  // characters on a multi-character precon.
  if (faceList?.length) {
    out.push({
      key: FACEKEY,
      label: faceList.length > 1 ? `Characters: ${faceList.length}` : 'Character',
      cards: faceList.map(c => ({ ...c, qty: c.qty || 1 })),
    })
  }
  if (sideList?.length) {
    out.push({
      key: SIDEKEY,
      label: `Sideboard: ${sideList.reduce((sum, c) => sum + c.qty, 0)}`,
      cards: sideList,
    })
  }
  return out
}

const effectivePartitions = computed(
  () => props.partitions ?? partitionByType(props.faceList, props.deckList, props.sideList)
)

const gridStyle = computed(() => ({ gridTemplateColumns: `repeat(${props.columns}, 1fr)` }))

// Every main-deck group is one 'main' zone: groups are derived from card stats,
// so moving a card between them means nothing. Position doesn't either, which is
// why no card carries data-card-slot and a same-zone drop is a no-op.
const zoneOf = partition =>
  partition.key === SIDEKEY ? 'side' : partition.key === MAYBEKEY ? 'maybe' : 'main'
// Side and maybe groups share the off-board styling (amber label, grey rows).
const isSide = partition => zoneOf(partition) !== 'main'

function dragBind(card, partition) {
  if (!props.drag) return {}
  const h = props.drag.handlers({ card, zone: zoneOf(partition) })
  return {
    ...h,
    // Mouse and pen only. Tiles fill the page, so taking touch for dragging would
    // stop phones scrolling the deck; touch keeps the tile buttons instead.
    onPointerdown: e => { if (e.pointerType !== 'touch') h.onPointerdown(e) },
  }
}

// The deck renders as one region per board, so each board is a single drop
// target (gaps between its groups included) with a single outline.
const boards = computed(() => [
  { zone: 'main', label: 'Mainboard' },
  { zone: 'side', label: 'Sideboard' },
  { zone: 'maybe', label: 'Maybeboard' },
].map(b => ({ ...b, partitions: effectivePartitions.value.filter(p => zoneOf(p) === b.zone) }))
  .filter(b => b.partitions.length))

// A board is "armed" while a card from another board is in flight, and
// "hover" while that card is over it.
const armed = zone => !!props.drag?.dragging.value
  && !!props.drag.dragInst.value && props.drag.dragInst.value.zone !== zone
const isHover = zone => armed(zone) && props.drag.hoverZone.value === zone
const boardClass = zone => ({
  'board--armed': armed(zone),
  'board--hover': isHover(zone),
})

// Live-store helpers for the editable list view.
const OPS = {
  main: { qty: a => store.quantity(a), inc: c => store.increment(c), dec: c => store.decrement(c) },
  side: { qty: a => store.sideQuantity(a), inc: c => store.incrementSide(c), dec: c => store.decrementSide(c) },
  maybe: { qty: a => store.maybeQuantity(a), inc: c => store.incrementMaybe(c), dec: c => store.decrementMaybe(c) },
}
function liveQty(card, zone) {
  return OPS[zone].qty(card.asset)
}
function inc(card, zone) {
  OPS[zone].inc(card)
}
function dec(card, zone) {
  OPS[zone].dec(card)
}
</script>

<template>
  <!-- ── Tiles view ─────────────────────────────────────────── -->
  <template v-if="view === 'tiles'">
    <div
      v-for="board in boards"
      :key="board.zone"
      class="board"
      :class="boardClass(board.zone)"
      :data-drop-zone="drag ? board.zone : undefined"
    >
      <div v-if="armed(board.zone)" class="board__tag">{{ board.label }}</div>
      <div
        v-for="partition in board.partitions"
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
            :board="zoneOf(partition)"
            :editable="editable"
            :class="{ 'deck-tile--draggable': drag }"
            v-bind="dragBind(card, partition)"
            @card-click="emit('card-click', $event)"
          />
        </div>
      </div>
    </div>
  </template>

  <!-- ── List view ──────────────────────────────────────────── -->
  <q-list v-else bordered class="deck-listview">
    <div
      v-for="board in boards"
      :key="board.zone"
      class="board"
      :class="boardClass(board.zone)"
      :data-drop-zone="drag ? board.zone : undefined"
    >
      <div v-if="armed(board.zone)" class="board__tag">{{ board.label }}</div>
      <div
        v-for="partition in board.partitions"
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
          :class="isSide(partition) ? 'card-list-side' : `card-list-${card.type}`"
          v-bind="dragBind(card, partition)"
          @click="emit('card-click', card)"
        >
          <q-item-section avatar>
            <q-avatar square class="card-thumb">
              <img :src="getCardImage(card.asset)" class="card-thumb__img" :alt="card.name" />
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label lines="2">
              <span class="list-qty">{{ editable ? liveQty(card, zoneOf(partition)) : card.qty }}</span>
              {{ card.name }}
            </q-item-label>
          </q-item-section>
          <q-item-section v-if="editable" side @click.stop>
            <div class="row no-wrap items-center">
              <q-btn round dense size="sm" flat color="negative" icon="remove"
                @click="dec(card, zoneOf(partition))" />
              <q-btn round dense size="sm" flat color="positive" icon="add"
                @click="inc(card, zoneOf(partition))" />
            </div>
          </q-item-section>
        </q-item>
      </div>
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

/* Drag-and-drop (only when a `drag` instance is passed) */
.deck-tile--draggable {
  cursor: grab;
  user-select: none;
}
.deck-tile--draggable :deep(img) {
  -webkit-user-drag: none; /* keep the browser's native image drag out of the way */
}
/* One region per board. Mid-drag, the board the card could move to is outlined
   ("armed") and lights up while the card is over it. */
.board {
  position: relative;
  border-radius: 10px;
  outline: 2px dashed transparent;
  outline-offset: 6px;
  transition: outline-color 0.12s ease, background-color 0.12s ease;
}
.board--armed {
  outline-color: rgba(255, 171, 64, 0.45);
}
.board--hover {
  outline-color: #ffab40;
  background-color: rgba(255, 171, 64, 0.08);
}
.board__tag {
  position: absolute;
  top: -16px;
  right: 8px;
  z-index: 1;
  padding: 1px 8px;
  border-radius: 6px;
  background: #ef6c00;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  pointer-events: none;
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
