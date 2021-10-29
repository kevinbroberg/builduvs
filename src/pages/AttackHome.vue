<script setup>
import { ref, computed, watch } from 'vue'
import Selector from 'components/filter/Selector.vue'
import Element from 'components/cards/detail/Element.vue'
import { cards, filteredCards, selections, symbolOptions } from "assets/card_provider.js"
function formatOptions() {
  return [...new Set(cards.map(card => card.formats).flat())]
}

const speed = ref(0)
const damage = ref(0)
const showPic = ref(false)
const me = computed(() => filteredCards.value.length == 1 ? filteredCards.value[0] : null)
watch(me, (now, __) => {
    //console.log("got a card!")
    now != null ? reset() : null
})
selections.value.types = ["attack"]

function zoneColor(zone) {
    switch(zone) {
        case 'low':
            return 'yellow-8'
        case 'high':
            return 'red-8'
        case 'mid':
            return 'deep-orange-8'
        default:
            return 'black'
    }

}

function reset() {
    selections.value.types = ["attack"]
    speed.value = me?.value?.speed || 0
    damage.value = me?.value?.damage || 0
    showPic.value = false
}
</script>

<template>
  <Selector v-model:picks="selections['symbols']" :options=symbolOptions name="Symbols">
    <template v-slot:button="{selected}">{{selected}}<Element :element=selected /></template>
  </Selector>
  <q-separator />
  <Selector name="Format" v-model:picks="selections.formats" :options="formatOptions()" />
  <q-separator />
  <q-btn push clickable ripple size='xl' spread @click=reset>Reset</q-btn>
  <div class="row" v-if="me != null" @click="showPic = !showPic"> 
      <h1 v-if="me != null">Using {{me?.name}}</h1>
  </div>
  <h1>Speed: 
      <q-btn push size='xl' :color=zoneColor(me?.attack_zone) clickable ripple @click="speed--" label="-"/>

      {{speed}}
      <q-btn push size='xl' :color=zoneColor(me?.attack_zone) clickable ripple @click="speed++" label="+"/>
  </h1>
  <h1>Damage: 
      <q-btn push size='xl' :color=zoneColor(me?.attack_zone) clickable ripple @click="damage--" label="-"/>
      {{damage}}
      <q-btn push size='xl' :color=zoneColor(me?.attack_zone) clickable ripple @click="damage++" label="+"/>
  </h1>
  <q-btn push clickable ripple size='xl' spread @click=reset>Reset</q-btn>
  <q-img v-if=showPic @click="showPic = false"
          style="max-height: 100vh" fit="contain"
          loading="lazy"
          :src="require('assets/images/card_images/' + me?.asset)"
          :alt="me?.name"/>
</template>