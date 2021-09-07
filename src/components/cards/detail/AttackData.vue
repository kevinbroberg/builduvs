<template>
<div class="isattack" v-if="card['type'] == 'attack'" >
  Attack {{getSpeed()}} <img :src="getZonePic()" title="Attack" style="vertical-align : -3px;" :alt="getZone()" /> {{getDamage()}} <br />
  </div>
</template>

<script>
export default {
    name: "AttackDisplay",
    props: {
      card: Object
    },
    data() {
      return {
      }
    },
    methods: {
      getZonePic() {
          return require('assets/images/attack' + this.getZone() + '.png')
      },
      getZone() {
        let s = this.card['attack_zone']
        if(!s) {
          return "unknown"
        }
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