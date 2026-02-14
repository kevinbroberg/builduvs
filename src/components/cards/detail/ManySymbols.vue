<template>
<span class="elements">
  <q-icon v-for="element in resources" v-bind:key="element" :alt="element" 
    :name="'img:' + pic(element)" />
</span>
</template>

<script>
import { getSymbolImage } from 'src/js/image_helper'

export default {
    name: "ManySymbols",
    props: {
      resources: Object
    },
    methods: {
        pic(s) {
            return getSymbolImage(this.switchSource(s))
        },
        switchSource(s) {
          return s ? s.toLowerCase() : "";
      }
    }
}
</script>