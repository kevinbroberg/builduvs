<script setup>
import { computed, ref, watch } from 'vue'
import { getCardImage } from 'src/js/image_helper'
import { cardByAsset, transformTarget } from 'src/js/card_provider'

const props = defineProps({
  // Card asset shown large in the right-hand preview slot (null = empty state).
  faceAsset: { type: String, default: null },
  faceName: { type: String, default: '' },
  emptyText: { type: String, default: 'No face character set' },
  // Narrows the body column so list-view color rows don't stretch full width.
  listView: { type: Boolean, default: false },
  // Show an overlay button to clear the face (edit contexts only).
  clearable: { type: Boolean, default: false },
})

defineEmits(['clear-face'])

const isEpic = computed(() => props.faceName?.trim().toLowerCase() === 'champion of the children')

// Double-sided cards get a "transform" button that flips the preview over to the
// other side. Purely a viewing aid — the deck still holds whichever side it holds.
const otherSide = computed(() => transformTarget(cardByAsset.get(props.faceAsset)))
const transformed = ref(false)
watch(() => props.faceAsset, () => { transformed.value = false })

const shownName = computed(() => (transformed.value ? otherSide.value?.name : props.faceName))
</script>

<template>
  <div class="deck-stage" :class="{ 'deck-stage--list': listView }">
    <!-- Left / center: whatever the page puts here (deck name + DeckBody) -->
    <div class="deck-stage__body">
      <slot />
    </div>

    <!-- Right: large face preview -->
    <div class="deck-stage__face">
      <template v-if="faceAsset">
        <div class="face-card-wrap">
          <div class="face-flipper" :class="{ 'face-flipper--flipped': transformed }">
            <div class="face-side">
              <q-img
                class="face-card"
                fit="contain"
                :ratio="59 / 86"
                :src="getCardImage(faceAsset)"
                :alt="faceName"
              />
              <div v-if="isEpic" class="epic-overlay">EPIC</div>
            </div>
            <div v-if="otherSide" class="face-side face-side--back">
              <q-img
                class="face-card"
                fit="contain"
                :ratio="59 / 86"
                :src="getCardImage(otherSide.asset)"
                :alt="otherSide.name"
              />
            </div>
          </div>
          <q-btn
            v-if="otherSide"
            class="face-transform"
            round
            dense
            color="purple-7"
            icon="flip_camera_android"
            @click="transformed = !transformed"
          >
            <q-tooltip>{{ transformed ? 'Transform back to' : 'Transform into' }}
              {{ transformed ? faceName : otherSide.name }}</q-tooltip>
          </q-btn>
        </div>
        <div v-if="shownName || clearable" class="face-name-row">
          <div v-if="shownName" class="face-name">{{ shownName }}</div>
          <q-btn
            v-if="clearable"
            class="face-clear"
            round
            dense
            color="negative"
            icon="close"
            size="sm"
            @click="$emit('clear-face')"
          >
            <q-tooltip>Clear face character</q-tooltip>
          </q-btn>
        </div>
      </template>
      <div v-else class="face-empty">
        <slot name="face-empty">
          <q-icon name="account_circle" size="64px" />
          <div>{{ emptyText }}</div>
        </slot>
      </div>
      <!-- Below the preview: e.g. DeckSummary on read-only decklist pages -->
      <slot name="face-footer" />
    </div>
  </div>
</template>

<style scoped>
.deck-stage {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: stretch;
  margin: 8px;
  padding: 20px;
  border-radius: 14px;
  background:
    radial-gradient(circle at 20% 0%, rgba(90, 60, 140, 0.35), transparent 60%),
    linear-gradient(135deg, #2a2f2a 0%, #1c1e24 55%, #14151a 100%);
  box-shadow: inset 0 0 120px rgba(0, 0, 0, 0.5);
  color: #fff;
}

.deck-stage__body {
  flex: 1 1 640px;
  min-width: 0;
}
/* In list view the text column shouldn't stretch into full-width color bars */
.deck-stage--list .deck-stage__body {
  flex: 0 1 560px;
  max-width: 560px;
}
/* The narrowed list body doesn't grow, so pin the face to the right edge
   (matching tiles view) instead of leaving it floating mid-row. */
.deck-stage--list .deck-stage__face {
  margin-left: auto;
}

/* ---- Face preview ---- */
.deck-stage__face {
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  position: sticky;
  top: 60px;
  align-self: flex-start;
}
.face-card-wrap {
  position: relative;
  width: 100%;
  max-width: 300px;
}
/* 3D flip between the two sides of a double-sided card */
.face-card-wrap {
  perspective: 1200px;
}
.face-flipper {
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1);
}
.face-flipper--flipped {
  transform: rotateY(180deg);
}
.face-side {
  position: relative;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.face-side--back {
  position: absolute;
  inset: 0;
  transform: rotateY(180deg);
}
.face-transform {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 3;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  opacity: 0.9;
}
.face-transform:hover {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .face-flipper {
    transition: none;
  }
}
.face-card {
  width: 100%;
  max-width: 300px;
  border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.7);
}
.epic-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 3rem;
  font-weight: 900;
  font-style: normal;
  font-stretch: expanded;
  letter-spacing: 3px;
  background: linear-gradient(135deg, #7dd3fc 0%, #a78bfa 50%, #c084fc 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-stroke: 1.5px rgba(255, 255, 255, 0.9);
  filter: drop-shadow(0 0 10px rgba(0, 0, 0, 0.85)) drop-shadow(0 0 4px rgba(0, 0, 0, 0.9));
  pointer-events: none;
  user-select: none;
  z-index: 2;
}
.face-name-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.face-name {
  color: #fff;
  font-size: 1.5rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
  text-align: center;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}
.face-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.5);
  padding-top: 40px;
}

@media (max-width: 700px) {
  .deck-stage__face {
    flex-basis: 100%;
    order: -1;
    position: static;
  }
}
</style>
