<template>
  <q-icon :name="'img:' + pic()" />
</template>

<script>
import { getSymbolImage, getAttackZoneImage, getBlockZoneImage } from 'src/js/image_helper'

export default {
    name: "ResourceSymbol",
    props: {
      element: String,
      isAttackZone: { type: Boolean, default: false },
      isBlockSymbol: { type: Boolean, default: false },
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