<template>
<span class="elements">
  <q-icon v-for="element in resources" v-bind:key="element" :alt="element" 
    :name="'img:' + pic(element)" />
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