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
    attack_zone.value = theAttack?.value?.attack_zone || "mid"
    showPic.value = false
}
function half(x) {
  return (x % 2) + (x/2 | 0)
}

selections.value.types = ["attack"]
selections.value.formats = ["My Hero Academia", "standard"]

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

function hiOrLow(e, hi, low) {
    var rect = e?.target?.getBoundingClientRect();
    if(!rect) {
        console.log(`sry no bounding rectange, only counting up`)
        hi()
        return 
    }
    // var x = e.clientX - rect.left; //x position within the element. - unused
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

function click3(e, hi, mid, low) {
    var rect = e?.target?.getBoundingClientRect();
    if(!rect) {
        console.log(`sry no bounding rectange, only counting up`)
        hi()
        return 
    }
    // var x = e.clientX - rect.left; //x position within the element. - unused
    var y = e.clientY - rect.top;  //y position within the element.
    var inc = (rect.bottom - rect.top)/3
    var t = (inc), m = t + inc
    // console.log(`Computed ${y} from client ${e.clientY} rect ${rect.top} and relative to ${mid}`);
    console.log(`${y} click bottom ${rect.bottom} top ${rect.top} step ${inc} first boundary ${t} second ${m}`)
    if(y < inc) {
        hi()
    } else if (y < 2*inc) {
        mid()
    } else {
        low()
    }
}

const p1 = ref({
    face : null,
    health : 0
})
const p2 = ref({
    face : null,
    health : 0
})
function updatePlayer(choice, player) {
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
  <NamePicker :label="'Select an attack'" /> 
  <q-separator />
  <!-- <div v-if="theAttack != null" class="row no-wrap justify-center"> 
      <h3 v-if="theAttack != null">Using {{theAttack?.name}}</h3>
      <q-btn square dense label="Show" :size="sm" @click="showPic = !showPic" />
  </div> -->
  <div>
    <PureCharacterPicker :label="'Select character for Player 1'" @update:character="updatePlayer($event, p1)" />
    <div class="row" v-if="p1.face" > 
      <div @click="hiOrLow($event, () => p1.health++, () => p1.health--)" 
        style="border: 2px solid red;" class="col-8">
        <h6 class="q-mx-none">Player 1 {{p1.face?.name}} {{p1.health}}</h6>  
      </div>
      <div class="col-4">
        <q-btn push color=green-12 text-color=black @click="p1.health -= half(damage); reset()">Take half</q-btn>
        <q-btn push color=purple-12 text-color=black @click="p1.health -= damage; reset()">Take full</q-btn>
      </div>
    </div>
  </div>

  <div class="row no-wrap justify-center ">
    <div class="self-center q-mx-md">
        <p v-if="theAttack != null">{{theAttack?.name}}:</p>
        <q-btn @click=reset>Reset</q-btn>
    </div>
    <div 
      @click="hiOrLow($event, () => speed++, () => speed--)" 
      style="padding: 5vw; border: 2px solid green;">
      <h3 class="q-mx-none">{{speed}}</h3>
    </div>
    <div class="self-center"
      :style="`padding: 2.5vw; background: ${zoneColor(attack_zone)};`" 
      @click="click3($event, () => attack_zone = 'high', () => attack_zone = 'mid', ()=> attack_zone = 'low')" >
      <h3 class="q-mx-none">
        <hr />
        {{attack_zone}}
        <hr />
      </h3>

    </div>
    <div 
      @click="hiOrLow($event, () => damage++, () => damage--)" 
      style="padding: 5vw; border: 2px solid red;">
      <h3 class="q-mx-none">{{damage}}</h3>
    </div>
  </div>

  <div>
      <PureCharacterPicker :label="'Select character for Player 2'" @update:character="updatePlayer($event, p2)" />
      <div class="row" v-if="p2.face">
      <div @click="hiOrLow($event, () => p2.health++, () => p2.health--)" 
        style="border: 2px solid red;" class="col-8">
        <h6 class="q-mx-none">Player 2 {{p2.face?.name}} {{p2.health}}</h6>  
      </div>
      <div class="col-4">
        <q-btn push color=green-12 text-color=black @click="p2.health -= half(damage); reset()">Take half</q-btn>
        <q-btn push color=purple-12 text-color=black @click="p2.health -= damage; reset()">Take full</q-btn>
      </div>
    </div>
  </div>
  <q-img v-if=showPic @click="showPic = false"
          style="max-height: 100vh" fit="contain"
          loading="lazy"
          :src="require('assets/images/card_images/' + theAttack?.asset)"
          :alt="theAttack?.name"/>
</template>
