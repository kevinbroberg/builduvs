<template>
<div class="hasblock" v-if="rawzone">
  <span>
    Block : +{{card['block_modifier']}} <q-icon :name="'img:' + getSource(rawzone)" /> <br/>
  </span>
</div>
</template>

<script>
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
            return require('assets/images/' + this.switchSource(s) + ' block.png')
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