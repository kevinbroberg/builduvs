<script setup>
import { ref, watch } from 'vue'
import Selector from 'components/filter/Selector.vue'
import SimpleTypePicker from 'src/components/filter/SimpleTypePicker.vue'
import Player from 'src/components/attack/Player.vue'
import Element from 'components/cards/detail/Element.vue'
import { selections, symbolOptions, formatOptions } from "assets/card_provider.js"

const defaults = { speed: 0 , damage: 5, health: 30, zone: 'mid'}
const speed = ref(defaults.speed)
const damage = ref(defaults.damage)
const attack_zone = ref(defaults.zone)
const showPic = ref(false)
const theAttack = ref({})
const mySymbolOptions = symbolOptions.filter(s => s != "infinity")
watch(theAttack, (now, __) => {
    //console.log("got a card!")
    now != null ? reset() : null
})

function reset() {
    speed.value = theAttack?.value?.speed || defaults.speed
    damage.value = theAttack?.value?.damage || defaults.damage
    attack_zone.value = theAttack?.value?.attack_zone || defaults.zone
    showPic.value = false
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
    var rect = target?.getBoundingClientRect()
    if(!rect) {
        console.log(`sry no bounding rectange, only counting up ${target}`)
        hi()
        return 
    }
    // var x = e.clientX - rect.left; //x position within the element. - unused
    var y = e.clientY - rect.top;  //y position within the element.
    var inc = (rect.bottom - rect.top)/3
    var t = inc, m = t + inc
    // console.log(`Computed ${y} from client ${e.clientY} rect ${rect.top} and relative to ${mid}`);
    console.log(`${e.target} ${y} click bottom ${rect.bottom} top ${rect.top} step ${inc} first boundary ${t} second ${m}`)
    if(y < t) {
        hi()
    } else if (y < m) {
        mid()
    } else {
        low()
    }
}
</script>

<template>
  <Selector v-model:picks="selections['symbols']" :options=mySymbolOptions name="Symbols">
    <template v-slot:button="{selected}">{{selected}}<Element :element=selected /></template>
  </Selector>
  <q-separator />
  <Selector name="Format" v-model:picks="selections.formats" :options="formatOptions" />
  <q-separator />
  <!-- <div v-if="theAttack != null" class="row no-wrap justify-center"> 
      <h3 v-if="theAttack != null">Using {{theAttack?.name}}</h3>
      
  </div> -->
  <Player />

  <div class="row no-wrap justify-center ">
    <div class="self-center col">
      <SimpleTypePicker :type="'attack'" :label="'Pick an attack'" 
        @update:choice="theAttack = $event" />
      <q-btn col push @click=reset>Reset</q-btn>
      <q-btn col push label="Show" @click="showPic = !!theAttack && !showPic" />
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
        {{attack_zone}}<Element :element="attack_zone + ' attack'" />
      </h3>
    </div>
    <div class="col"
      @click="hiOrLow($event, () => damage++, () => damage--)" 
      style="padding: 2vh; border: 2px solid red;">
      <h3 class="q-mx-none">{{damage}} damage</h3>
    </div>
  </div>

  <Player :damage=damage />
  <q-img v-if=showPic @click="showPic = false"
          style="max-height: 100vh" fit="contain"
          loading="lazy"
          :src="require('assets/images/card_images/' + theAttack?.asset)"
          :alt="theAttack?.name"/>
</template>
