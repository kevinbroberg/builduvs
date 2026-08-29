<template>
  <q-icon :name="iconName" :class="{ 'resource-symbol--confused': confused }">
    <q-tooltip v-if="confused">Mixed symbols — no single defining resource</q-tooltip>
  </q-icon>
</template>

<script>
import { getSymbolImage, getAttackZoneImage, getBlockZoneImage } from 'src/js/image_helper'
import { isConfused } from 'src/js/deck_symbol'

export default {
    name: "ResourceSymbol",
    props: {
      element: String,
      isAttackZone: { type: Boolean, default: false },
      isBlockSymbol: { type: Boolean, default: false },
    },
    computed: {
      // A deck whose main symbol could not be determined carries the 'confused'
      // sentinel, which has no icon file — render a question mark instead of an
      // empty "img:" source. See src/js/deck_symbol.js.
      confused() {
        return isConfused(this.element)
      },
      iconName() {
        if (this.confused) return 'help'
        const src = this.pic()
        return src ? 'img:' + src : 'help_outline'
      },
    },
    methods: {
        pic() {
            const name = this.switchSource(this.element)
            if (this.isAttackZone) return getAttackZoneImage(name)
            if (this.isBlockSymbol) return getBlockZoneImage(name)
            return getSymbolImage(name)
        },
        switchSource(s) {
          return s ? s.toLowerCase() : "";
      }
    }
}
</script>

<style scoped>
/* The question mark is a glyph, not artwork, so give it enough contrast to read
   at the small sizes the standings rows use. */
.resource-symbol--confused {
  color: #8a8a8a;
}
</style>
