<script setup>
// How a card looks on the tier board, per the board's view toggle:
//   avatar — round face crop (the default)
//   art    — a wider square of the art around the same face
//   card   — the whole card image
// `data-face` marks the visible picture itself (not the label space above it), which
// is what box select tests against.
import CardAvatar from 'src/components/cards/CardAvatar.vue'
import { getCardImage } from 'src/js/image_helper'

defineProps({
  card: { type: Object, required: true },
  mode: { type: String, default: 'avatar' },
  showName: { type: Boolean, default: true },
})
</script>

<template>
  <div class="tier-face" :class="`tier-face--${mode}`">
    <img v-if="mode === 'card'" data-face class="tier-face__card" :src="getCardImage(card.asset)"
      :alt="card.name" draggable="false" />
    <CardAvatar v-else data-face :card="card" :square="mode === 'art'"
      :size="mode === 'art' ? '96px' : '88px'" :show-name="showName" />
  </div>
</template>

<style scoped>
/* Room above the avatar and art faces for their tilted name label, which grows upward. */
.tier-face--avatar,
.tier-face--art {
  padding-top: 22px;
}
.tier-face__card {
  display: block;
  width: 112px;
  aspect-ratio: 744 / 1039;
  border-radius: 5%;
  background: #1c2230;
}
</style>
