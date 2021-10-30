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
const attack_zone = ref('mid')
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
            return 'yellow'
        case 'high':
            return 'red'
        case 'mid':
            return 'orange'
        default:
            return 'black'
    }

}

function reset() {
    selections.value.types = ["attack"]
    speed.value = me?.value?.speed || 0
    damage.value = me?.value?.damage || 0
    attack_zone.value = me?.value?.attack_zone || "unknown"
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
  <div v-if="me != null" class="row no-wrap justify-center"> 
      <h3 v-if="me != null">Using {{me?.name}}</h3>
      <!-- TODO dialog -->
      <q-btn class="q-mx-none" square dense label="Show" :size="sm" @click="showPic = !showPic" />
  </div>
  <div class="row no-wrap justify-center ">
    <q-btn push text-color=black clickable ripple @click="speed--" label="-"/>
    <h3 class="q-mx-none">{{speed}}</h3>
    <q-btn push text-color=black clickable ripple @click="speed++" label="+"/>
    <q-btn-dropdown dense auto-close :class="`bg-${zoneColor(attack_zone)}`">
        <template v-slot:label><h5 class="q-mx-none">{{attack_zone}}</h5></template>
        <q-list>
            <q-item v-for="zone in ['high', 'mid', 'low']" clickable v-ripple :key=zone :class="`bg-${zoneColor(zone)}`"
            @click="attack_zone = zone">
            <body class="text-capitalize">{{zone}}</body>
            </q-item>
        </q-list>
    </q-btn-dropdown>
    <q-btn push text-color=black clickable ripple @click="damage--" label="-"/>
    <h3 class="q-mx-none">{{damage}}</h3>
    <q-btn push text-color=black clickable ripple @click="damage++" label="+"/>
  </div>
  <div>
    <q-btn push clickable ripple size='xl' spread @click=reset>Reset</q-btn>
  </div>
  <q-img v-if=showPic @click="showPic = false"
          style="max-height: 100vh" fit="contain"
          loading="lazy"
          :src="require('assets/images/card_images/' + me?.asset)"
          :alt="me?.name"/>
</template>