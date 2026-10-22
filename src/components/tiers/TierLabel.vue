<script setup>
// A tier label with its `:emoji:` codes swapped for icons. See src/js/tier_emoji.js.
import { computed } from 'vue'
import { parseTierLabel } from 'src/js/tier_emoji'

const props = defineProps({
  label: { type: String, default: '' },
  // Blow the icons up when the label is nothing but emoji, as Discord does.
  jumbo: { type: Boolean, default: false },
})

const parts = computed(() => parseTierLabel(props.label))
const isJumbo = computed(() =>
  props.jumbo && parts.value.every(p => p.emoji || !p.text.trim()))
</script>

<template>
  <span class="tier-label" :class="{ 'tier-label--jumbo': isJumbo }"><template v-for="(p, i) in parts" :key="i"><img v-if="p.emoji"
    class="tier-label__emoji" :src="p.src" :alt="`:${p.emoji}:`" :title="`:${p.emoji}:`"
    draggable="false" /><template v-else>{{ p.text }}</template></template></span>
</template>

<style scoped>
.tier-label__emoji {
  height: 1.375em;
  width: auto;
  vertical-align: middle;
  margin: -0.2em 0.05em 0;
}
.tier-label--jumbo .tier-label__emoji {
  height: 2.4em;
  margin: 0;
}
</style>
