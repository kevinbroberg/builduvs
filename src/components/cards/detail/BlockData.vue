<template>
<div class="hasblock" v-if="rawzone">
  <span>
    Block : +{{card['block_modifier']}} <q-icon :name="'img:' + getSource(rawzone)" /> <br/>
  </span>
</div>
</template>

<script>
import { getSymbolImage } from 'src/js/image_helper'

export default {
    name: "BlockDisplay",
    props: {
      card: Object
    },
    data() {
      return {
        rawzone: this.card['block_zone']
      }
    },
    methods: {
        getSource(s) {
            return getSymbolImage(this.switchSource(s) + ' block')
        },
        switchSource(s) {
            s = s.toLowerCase();
            if (s.startsWith('h')) {
            return 'high';
        }
        if (s.startsWith('m')) {
            return 'mid';
        }
        if (s.startsWith('l')) {
            return 'low';
        }
      }
    }
}
</script>