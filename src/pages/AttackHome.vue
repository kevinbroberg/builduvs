<script setup>
import { ref, watch } from 'vue'
import Selector from 'components/filter/Selector.vue'
import SimpleTypePicker from 'src/components/filter/SimpleTypePicker.vue'
import Element from 'components/cards/detail/Element.vue'
import { cards, filteredCards, selections, symbolOptions } from "assets/card_provider.js"
function formatOptions() {
  return [...new Set(cards.map(card => card.formats).flat())]
}

const speed = ref(0)
const damage = ref(0)
const attack_zone = ref('mid')
const showPic = ref(false)
const theAttack = ref({})
watch(theAttack, (now, __) => {
    //console.log("got a card!")
    now != null ? reset() : null
})

function reset() {
    speed.value = theAttack?.value?.speed || 0
    damage.value = theAttack?.value?.damage || 0
    attack_zone.value = theAttack?.value?.attack_zone || "mid"
    showPic.value = false
}
function half(x) {
  return (x % 2) + (x/2 | 0)
}

function zoneColor(zone) {
    switch(zone) {
        case 'low':
            return 'yellow-10'
        case 'high':
            return 'red-10'
        case 'mid':
            return 'orange-10'
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
    var target = e?.target
    // this is AWFUL practice I'm sure...
    target = target.tagName === "DIV" ? target : target.parentNode
    var rect = target?.getBoundingClientRect();
    if(!rect) {
        console.log(`sry no bounding rectange, only counting up ${target}`)
        hi()
        return 
    }
    // var x = e.clientX - rect.left; //x position within the element. - unused
    var y = e.clientY - rect.top;  //y position within the element.
    var inc = (rect.bottom - rect.top)/3
    var t = (inc), m = t + inc
    // console.log(`Computed ${y} from client ${e.clientY} rect ${rect.top} and relative to ${mid}`);
    console.log(`${e.target} ${y} click bottom ${rect.bottom} top ${rect.top} step ${inc} first boundary ${t} second ${m}`)
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
  <!-- <div v-if="theAttack != null" class="row no-wrap justify-center"> 
      <h3 v-if="theAttack != null">Using {{theAttack?.name}}</h3>
      <q-btn square dense label="Show" :size="sm" @click="showPic = !showPic" />
  </div> -->
  <div>
    <SimpleTypePicker :type="'character'" :label="'Select character for Player 1'" @update:choice="updatePlayer($event, p1)" />
    <div class="row" v-if="p1.face" > 
      <div @click="hiOrLow($event, () => p1.health++, () => p1.health--)" 
        style="border: 2px solid red;" class="col-6">
        <h2 class="q-mx-none self-center text-center">{{p1.health}}</h2>  
      </div>
      <q-btn push class="col-2" color=green-12 text-color=black @click="p1.health -= half(damage); reset()">Take half</q-btn>
      <q-btn push class="col-2" color=purple-12 text-color=black @click="p1.health -= damage; reset()">Take full</q-btn>
      <q-btn push class="col-2" text-color=black @click="p1.health = p1.face.vitality">Reset</q-btn>
    </div>
  </div>

  <div class="row no-wrap justify-center ">
    <div class="self-center col">
      <SimpleTypePicker :type="'attack'" :label="'Pick an attack'" 
        @update:choice="theAttack = $event" />
      <q-btn row push @click=reset>Reset</q-btn>
    </div>
    <div class="col"
      @click="hiOrLow($event, () => speed++, () => speed--)" 
      style="padding: 2vh; border: 2px solid green;">
      <h3 class="q-mx-none">{{speed}} speed</h3>
    </div>
    <div class="self-center text-center col"
      :style="`padding: 2vh;`" 
      :class="`bg-${zoneColor(attack_zone)}`"
      @click="click3($event, () => attack_zone = 'high', () => attack_zone = 'mid', ()=> attack_zone = 'low')" >
      <h3 class="q-mx-none">
        {{attack_zone}}<Element :element="attack_zone + ' block'" />
      </h3>
    </div>
    <div class="col"
      @click="hiOrLow($event, () => damage++, () => damage--)" 
      style="padding: 2vh; border: 2px solid red;">
      <h3 class="q-mx-none">{{damage}} damage</h3>
    </div>
  </div>

  <div>
      <SimpleTypePicker :type="'character'" :label="'Select character for Player 2'" @update:choice="updatePlayer($event, p2)" />
      <div class="row" v-if="p2.face">
      <div @click="hiOrLow($event, () => p2.health++, () => p2.health--)" 
        style="border: 2px solid red;" class="col-6">
        <h2 class="q-mx-none self-center text-center">{{p2.health}}</h2>  
      </div>
      <q-btn push class="col-2" color=green-12 text-color=black @click="p2.health -= half(damage); reset()">Take half</q-btn>
      <q-btn push class="col-2" color=purple-12 text-color=black @click="p2.health -= damage; reset()">Take full</q-btn>
      <q-btn push class="col-2" text-color=black @click="p2.health = p2.face.vitality">Reset</q-btn>
    </div>
  </div>
  <q-img v-if=showPic @click="showPic = false"
          style="max-height: 100vh" fit="contain"
          loading="lazy"
          :src="require('assets/images/card_images/' + theAttack?.asset)"
          :alt="theAttack?.name"/>
</template>
