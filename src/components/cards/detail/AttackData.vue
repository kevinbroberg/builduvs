<template>
<div class="isattack" v-if="card.type == 'attack'" >
  Attack {{getSpeed()}} <ResourceSymbol :element="getZone()" isAttackZone /> {{getDamage()}} <br />
  </div>
</template>

<script>
import ResourceSymbol from "./ResourceSymbol.vue"
export default {
    components: { ResourceSymbol },
    name: "AttackData",
    props: {
      card: Object
    },
    data() {
      return {
      }
    },
    methods: {
      getZone() {
        return this.card['attack_zone']
      },
      getDamage() {
        return this.card['damage'] // these were made to be durable to badly formed card data, but why bother with that when I can just form it well
      },
      getSpeed() {
        return this.card['speed']
      }
    }
}
</script>