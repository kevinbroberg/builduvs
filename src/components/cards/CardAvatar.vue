<script setup>
// A card's art as a round avatar, cropped to the character's face when
// scripts/detect-avatars.py found one (src/assets/avatars.json), otherwise to
// the same top-of-art crop the square thumbnails use. With `showName`, the card
// name sits across the top edge in an outlined, tilted label tinted from the art.
// With `square`, a wider square of the art around the same face instead of a circle.
import { computed } from 'vue'
import avatars from 'assets/avatars.json'
import { getCardImage } from 'src/js/image_helper'

const props = defineProps({
  card: { type: Object, required: true },
  size: { type: String, default: '48px' },
  showName: { type: Boolean, default: false },
  square: { type: Boolean, default: false },
})

const CARD_ASPECT = 1039 / 744                // card image height / width
const FALLBACK = [0.5, 0.256, 0.357, null]    // matches .standing-avatar's scale(1.4) top crop

// How much more of the art a square shows around a detected face, and the bounds
// on its half-width (in card widths): enough to read as art, never the frame.
const SQUARE_ZOOM = 2.4
const SQUARE_HALF = [0.3, 0.45]
// Roughly where the art gives way to the name bar and text box, as a fraction of
// the card's height. A square stops above it, sliding up (or shrinking) to fit.
const ART_BOTTOM = 0.55

const crop = computed(() => avatars[props.card.asset] ?? FALLBACK)

// [cx, cy, r]: centre as fractions of the card's width/height, r (half the visible
// width) as a fraction of its width.
const frame = computed(() => {
  const [cx, cy, r] = crop.value
  if (!props.square || !avatars[props.card.asset]) return [cx, cy, r]
  const artBottom = ART_BOTTOM * CARD_ASPECT  // in card widths, like `half`
  const half = Math.min(SQUARE_HALF[1], Math.max(SQUARE_HALF[0], r * SQUARE_ZOOM), artBottom / 2)
  // Slide the wider square back inside the art rather than show past its edge.
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
  const x = clamp(cx, half, 1 - half)
  const y = clamp(cy * CARD_ASPECT, half, artBottom - half) / CARD_ASPECT
  return [x, y, half]
})

const imgStyle = computed(() => {
  const [cx, cy, r] = frame.value
  const width = 100 / (2 * r)                 // % of the circle's width
  return {
    width: `${width}%`,
    left: `${50 - cx * width}%`,
    top: `${50 - cy * width * CARD_ASPECT}%`,
  }
})

// "Erwin Smith, Strategic Mastermind" -> "Erwin Smith": the title won't fit.
const label = computed(() => props.card.name.split(',')[0])

// Past 10 characters a name breaks onto two lines, at the space nearest its middle:
// a long single line shrinks to illegible. The break is explicit because the browser
// only wraps text that overflows, and this label is sized to fit, not to overflow.
const lines = computed(() => {
  const text = label.value
  if (text.length <= 10 || !text.includes(' ')) return [text]
  const mid = text.length / 2
  let at = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ' && (at < 0 || Math.abs(i - mid) < Math.abs(at - mid))) at = i
  }
  return [text.slice(0, at), text.slice(at + 1)]
})
const labelText = computed(() => lines.value.join('\n'))

// Size the text so its longest line fits. The square's level banner spans the tile's
// width; the slanted label hangs past it (116%), so has more room.
const labelStyle = computed(() => {
  const longest = Math.max(...lines.value.map(l => l.length))
  const room = props.square ? 100 / 116 : 1
  return { fontSize: `${Math.min(15, (100 * room) / (longest * 0.68))}cqw` }
})

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
      <img :src="getCardImage(card.asset)" :alt="card.name" :style="imgStyle" draggable="false" />
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
