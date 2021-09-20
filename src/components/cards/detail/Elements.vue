<template>
<span class="elements">
  <img v-for="elem in resources" v-bind:key=elem :src="pic(elem)" :alt=elem /> <br/>
</span>
</template>

<script>
export default {
    name: "Elements",
    props: {
      resources: Object
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