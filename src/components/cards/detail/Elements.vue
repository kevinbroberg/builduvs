<template>
<div class="elements">
  <img v-for="elem in card.resources" v-bind:key=elem :src="pic(elem)" :alt=elem /> <br/>
</div>
</template>

<script>
export default {
    name: "Elements",
    props: {
      card: Object
    },
    methods: {
        pic(s) {
            return require('assets/images/' + this.switchSource(s) + '.png')
        },
        switchSource(s) {
          return s ? s.toLowerCase() : "";
      }
    }
}
</script>