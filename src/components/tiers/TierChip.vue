<script setup>
// One card on the tier board: its face (see TierFace) plus a right-click menu showing
// the card at a readable size beside its destinations.
// The page binds the drag handlers onto the root (they fall through as attrs) and
// decides what a "send" acts on — this card, or the whole selection.
import TierFace from 'src/components/tiers/TierFace.vue'
import TierLabel from 'src/components/tiers/TierLabel.vue'
import { getCardImage } from 'src/js/image_helper'
import { textOn } from 'src/js/tier_colors'

defineProps({
  card: { type: Object, required: true },
  mode: { type: String, default: 'avatar' },
  selected: Boolean,
  lifted: Boolean,
  // How many cards a send moves; > 1 when this card is part of a selection.
  count: { type: Number, default: 1 },
  // [{ id, label, color }] — tiers to offer, already excluding a no-op one.
  targets: { type: Array, required: true },
  canUnrank: Boolean,
})

const emit = defineEmits(['send'])
</script>

<template>
  <div class="tier-chip" data-card-slot :data-asset="card.asset"
    :class="{ 'tier-chip--selected': selected, 'tier-chip--lifted': lifted }">
    <TierFace :card="card" :mode="mode" />
    <q-menu context-menu auto-close>
      <div class="tier-chip__menu">
        <img class="tier-chip__menu-card" :src="getCardImage(card.asset)" :alt="card.name" />
        <q-list dense class="tier-chip__menu-list">
          <q-item-label header class="q-py-xs">
            {{ count > 1 ? `Move ${count} cards to…` : card.name }}
          </q-item-label>
          <q-item v-for="t in targets" :key="t.id" clickable class="tier-chip__target"
            :style="{ background: t.color, color: textOn(t.color) }" @click="emit('send', t.id)">
            <q-item-section><TierLabel :label="t.label" /></q-item-section>
          </q-item>
          <template v-if="canUnrank">
            <q-separator />
            <q-item clickable @click="emit('send', null)">
              <q-item-section avatar><q-icon name="undo" size="xs" /></q-item-section>
              <q-item-section>Unranked</q-item-section>
            </q-item>
          </template>
        </q-list>
      </div>
    </q-menu>
  </div>
</template>

<style scoped>
.tier-chip {
  cursor: grab;
  touch-action: none; /* chips are drag handles; don't let the browser pan instead */
  user-select: none;
}
.tier-chip :deep(img) {
  -webkit-user-drag: none;
  pointer-events: none;
}
.tier-chip--selected :deep(.card-avatar__circle),
.tier-chip--selected :deep(.tier-face__card) {
  box-shadow: 0 0 0 3px #1976d2, 0 0 12px 4px rgba(25, 118, 210, 0.65);
}
.tier-chip--selected :deep([data-face]) {
  transform: translateY(-3px);
}
.tier-chip--lifted { opacity: 0.3; }

.tier-chip__menu {
  display: flex;
  flex-wrap: wrap; /* narrow screens: card on top, destinations below */
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
}
/* ~320px is where card text becomes comfortably readable. */
.tier-chip__menu-card {
  width: min(320px, 80vw);
  aspect-ratio: 744 / 1039;
  border-radius: 4.5%;
  background: #1c2230;
}
.tier-chip__menu-list {
  min-width: 170px;
  flex: 1;
}
/* Stacked on a phone, the destinations go first so they're on screen without
   scrolling past the card. */
@media (max-width: 599px) {
  .tier-chip__menu-list { order: -1; }
}

/* Each destination drawn in its tier's color, like the row label on the board. */
.tier-chip__target {
  border-radius: 4px;
  margin-bottom: 3px;
  font-weight: 600;
}
</style>
