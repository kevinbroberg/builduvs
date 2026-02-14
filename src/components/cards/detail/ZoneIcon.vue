<template>
  <ResourceSymbol :element="getZone()" />
</template>

<script>
  import ResourceSymbol from "components/cards/detail/ResourceSymbol.vue"
  export default {
    props: {
        attack: Object,
        zone: String
    },
    components: {
      ResourceSymbol
    },
    methods: {
      getZone() {
        if (this.zone) {
            return this.zone
        }
        let s = this.attack['attack_zone']
        if(!s) {
          return "unknown"
        }
        s = s.toLowerCase();
        // this was defensive coding. unsure why
        if (s.startsWith('h')) {
          return 'high attack';
        }
        if (s.startsWith('m')) {
          return 'mid attack';
        }
        if (s.startsWith('l')) {
          return 'low attack';
        }
      },
    }
  }
</script>