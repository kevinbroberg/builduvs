<template>
<div class="isattack" v-if="this.card['type'] == 'attack'" >
  Attack {{getSpeed()}} <ZoneIcon :attack=this.card /> {{getDamage()}} <br />
  </div>
</template>

<script>
import ZoneIcon from "./ZoneIcon.vue"
export default {
    components: { ZoneIcon },
    name: "AttackData",
    props: {
      card: Object
    },
    data() {
      return {
      }
    },
    methods: {
      getDamage() {
        return this.card['damage'] // these were made to be durable to badly formed card data, but why bother with that when I can just form it well
      },
      getSpeed() {
        return this.card['speed']
      }
    }
}
</script>