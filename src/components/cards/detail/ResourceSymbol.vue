<template>
  <q-icon :name="'img:' + pic()" />
</template>

<script>
import { getSymbolImage } from 'src/js/image_helper'

export default {
    name: "ResourceSymbol",
    props: {
      element: String
    },
    methods: {
        pic() {
            return getSymbolImage(this.switchSource(this.element))
        },
        switchSource(s) {
          return s ? s.toLowerCase() : "";
      }
    }
}
</script>