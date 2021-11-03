<script setup>
import { ref, computed, watch } from 'vue'
import Selector from 'components/filter/Selector.vue'
import NamePicker from 'components/filter/NamePicker.vue'
import PureCharacterPicker from 'components/filter/PureCharacterPicker.vue'
import Element from 'components/cards/detail/Element.vue'
import { cards, filteredCards, selections, symbolOptions } from "assets/card_provider.js"
function formatOptions() {
  return [...new Set(cards.map(card => card.formats).flat())]
}

const speed = ref(0)
const damage = ref(0)
const attack_zone = ref('mid')
const showPic = ref(false)
const theAttack = computed(() => filteredCards.value.length == 1 ? filteredCards.value[0] : null)
watch(theAttack, (now, __) => {
    //console.log("got a card!")
    now != null ? reset() : null
})

function reset() {
    selections.value.types = ["attack"]
    speed.value = theAttack?.value?.speed || 0
    damage.value = theAttack?.value?.damage || 0
    attack_zone.value = theAttack?.value?.attack_zone || "unknown"
    showPic.value = false
}

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

function routeClick(e, hi, low) {
    var rect = e?.target?.getBoundingClientRect();
    if(!rect) {
        console.log(`sry no bounding rectange, only counting up`)
        hi()
        return 
    }
    var x = e.clientX - rect.left; //x position within the element.
    var y = e.clientY - rect.top;  //y position within the element.
    var mid = (rect.bottom - rect.top)/2
    // console.log(`Computed ${y} from client ${e.clientY} rect ${rect.top} and relative to ${mid}`);
    // console.log(`do high? ${y < mid}`)
    if(y < mid) {
        hi()
    } else {
        low()
    }
}

const player1 = ref(null)
const p1Health = ref(0)
const player2 = ref(null)
const p2Health = ref(0)

const p1 = ref({
    face : null,
    health : 0
})
const p2 = ref({
    face : null,
    health : 0
})
function updatePlayer(choice, player) {
    console.log(`update ${choice} ${player}`)
    player.health = choice.vitality
    player.face = choice
}
</script>

<template>
  <Selector v-model:picks="selections['symbols']" :options=symbolOptions name="Symbols">
    <template v-slot:button="{selected}">{{selected}}<Element :element=selected /></template>
  </Selector>
  <q-separator />
  <Selector name="Format" v-model:picks="selections.formats" :options="formatOptions()" />
  <q-separator />
  <!-- TODO namepicker to accept a label param to clarify, "search for ATTACK" -->
  <NamePicker /> 
  <q-separator />
  <!-- <div v-if="theAttack != null" class="row no-wrap justify-center"> 
      <h3 v-if="theAttack != null">Using {{theAttack?.name}}</h3>
      <q-btn square dense label="Show" :size="sm" @click="showPic = !showPic" />
  </div> -->
  <div>
      <PureCharacterPicker @update:character="updatePlayer($event, p1)" />
      <div @click="routeClick($event, () => p1.health++, () => p1.health--)" style="border: 2px solid red;"><h6 class="q-mx-none">Player 1 {{p1.face?.name}} {{p1.health}}</h6></div>
  </div>
  <div class="row no-wrap justify-center ">
    <p v-if="theAttack != null">{{theAttack?.name}}:</p>
    <div @click="routeClick($event, () => speed++, () => speed--)" style="padding: 5vw; border: 2px solid green;"><h3 class="q-mx-none">{{speed}}</h3></div>
    <q-btn-dropdown dense auto-close :class="`bg-${zoneColor(attack_zone)}`">
        <template v-slot:label><h5 class="q-mx-none">{{attack_zone}}</h5></template>
        <q-list>
            <q-item v-for="zone in ['high', 'mid', 'low']" clickable v-ripple :key=zone :class="`bg-${zoneColor(zone)}`"
            @click="attack_zone = zone">
            <body class="text-capitalize">{{zone}}</body>
            </q-item>
        </q-list>
    </q-btn-dropdown>
    <div @click="routeClick($event, () => damage++, () => damage--)" style="padding: 5vw; border: 2px solid red;"><h3 class="q-mx-none">{{damage}}</h3></div>
  </div>  
  <div>
      <PureCharacterPicker @update:character="updatePlayer($event, p2)" />
      <div @click="routeClick($event, () => p2.health++, () => p2.health--)" style="border: 2px solid red;"><h6 class="q-mx-none">Player 2 {{p2.face?.name}} {{p2.health}}</h6></div>
  </div>
  <q-img v-if=showPic @click="showPic = false"
          style="max-height: 100vh" fit="contain"
          loading="lazy"
          :src="require('assets/images/card_images/' + theAttack?.asset)"
          :alt="theAttack?.name"/>
</template>