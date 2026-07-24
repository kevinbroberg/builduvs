<script setup>
import { getCardImage } from 'src/js/image_helper'

defineProps({
  // Card asset shown large in the right-hand preview slot (null = empty state).
  faceAsset: { type: String, default: null },
  faceName: { type: String, default: '' },
  emptyText: { type: String, default: 'No face character set' },
  // Narrows the body column so list-view color rows don't stretch full width.
  listView: { type: Boolean, default: false },
})
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
        <q-img
          class="face-card"
          fit="contain"
          :ratio="59 / 86"
          :src="getCardImage(faceAsset)"
          :alt="faceName"
        />
        <div v-if="faceName" class="face-name">{{ faceName }}</div>
      </template>
      <div v-else class="face-empty">
        <slot name="face-empty">
          <q-icon name="account_circle" size="64px" />
          <div>{{ emptyText }}</div>
        </slot>
      </div>
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
.face-card {
  width: 100%;
  max-width: 300px;
  border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.7);
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
