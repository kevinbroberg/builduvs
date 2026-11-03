<script setup>
// A card's art as a round avatar, cropped to the character's face when
// scripts/detect-avatars.py found one (src/assets/avatars.json), otherwise to
// the same top-of-art crop the square thumbnails use. With `showName`, the card
// name sits across the top edge in an outlined, tilted label tinted from the art.
// With `square`, a wider square of the art around the same face instead of a circle.
// The crop and label math lives in src/js/card_avatar.js, shared with the tier image export.
import { computed } from 'vue'
import { getCardImage } from 'src/js/image_helper'
import {
  CARD_ASPECT, avatarCrop, avatarFrame, avatarLines, avatarFontSize,
} from 'src/js/card_avatar'

const props = defineProps({
  card: { type: Object, required: true },
  size: { type: String, default: '48px' },
  showName: { type: Boolean, default: false },
  square: { type: Boolean, default: false },
})

const crop = computed(() => avatarCrop(props.card))
const frame = computed(() => avatarFrame(props.card, props.square))

const imgStyle = computed(() => {
  const [cx, cy, r] = frame.value
  const width = 100 / (2 * r)                 // % of the circle's width
  return {
    width: `${width}%`,
    left: `${50 - cx * width}%`,
    top: `${50 - cy * width * CARD_ASPECT}%`,
  }
})

// The line break is explicit because the browser only wraps text that overflows, and
// this label is sized to fit, not to overflow.
const lines = computed(() => avatarLines(props.card))
const labelText = computed(() => lines.value.join('\n'))

const labelStyle = computed(() => ({ fontSize: `${avatarFontSize(lines.value, props.square)}cqw` }))

const rootStyle = computed(() => {
  const hue = crop.value[3]
  return {
    width: props.size,
    height: props.size,
    ...(hue == null ? {} : {
      '--avatar-light': `hsl(${hue} 100% 72%)`,
      '--avatar-dark': `hsl(${hue} 67% 13%)`,
    }),
  }
})
</script>

<template>
  <div class="card-avatar" :class="{ 'card-avatar--square': square }" :style="rootStyle">
    <div class="card-avatar__circle">
      <img :src="getCardImage(card.asset)" :alt="card.name" :style="imgStyle" draggable="false"
        crossorigin="anonymous" />
    </div>
    <div v-if="showName" class="card-avatar__name" :style="labelStyle" aria-hidden="true">
      <span class="card-avatar__name-outer">{{ labelText }}</span>
      <span class="card-avatar__name-inner">{{ labelText }}</span>
    </div>
  </div>
</template>

<style scoped>
.card-avatar {
  --avatar-light: #d6dbe4;
  --avatar-dark: #1c2230;
  position: relative;
  display: inline-block;
  flex: none;
  container-type: inline-size;
}
.card-avatar__circle {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  overflow: hidden;
  border: 1.6cqw solid var(--avatar-light);
  box-shadow: 0 0 0 1.4cqw var(--avatar-dark);
  background: var(--avatar-dark);
}
.card-avatar--square .card-avatar__circle {
  border-radius: 8%;
}
.card-avatar__circle img {
  position: absolute;
  height: auto;
  max-width: none;
}
/* Two copies of the text stacked in one grid cell: the back one carries the
   light outer ring, the front one the dark inner ring and white fill. */
.card-avatar__name {
  position: absolute;
  white-space: pre-line;  /* honour the break `lines` chose */
  bottom: 80%;          /* a second line grows upward, off the face */
  left: -8%;
  width: 116%;
  display: grid;
  transform: rotate(-7deg);
  transform-origin: bottom left;
  font-family: 'Arial Black', 'Arial Bold', Gadget, sans-serif;
  font-weight: 900;
  font-variant: small-caps;
  line-height: 0.95;
  text-wrap: balance;
  pointer-events: none;
}
/* A square tile gets a level banner across its top edge instead. */
.card-avatar--square .card-avatar__name {
  left: 0;
  width: 100%;
  transform: none;
  text-align: center;
  justify-items: center;
}
.card-avatar__name > span {
  grid-area: 1 / 1;
  align-self: end;
  paint-order: stroke fill;
  color: #fff;
}
.card-avatar__name-outer {
  -webkit-text-stroke: 0.44em var(--avatar-light);
}
.card-avatar__name-inner {
  -webkit-text-stroke: 0.24em var(--avatar-dark);
}
</style>
