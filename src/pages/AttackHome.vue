<script setup>
import { ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { hiOrLow, click3 } from "src/js/hiorlowlogic.js"
import Player from 'src/components/attack/Player.vue'
import Element from 'components/cards/detail/Element.vue'

const $q = useQuasar()

const storage_key = "attack_default"
const default_defaults = { speed: 4 , damage: 5, p1hp: 30, p2hp: 30, zone: 'mid'}
const initial_defaults = $q.localStorage?.getItem(storage_key) || default_defaults

const defaults = ref(initial_defaults)
const speed = ref(defaults.value.speed)
const damage = ref(defaults.value.damage)
const attack_zone = ref(defaults.value.zone)

// Players watch this to determine when to reset
const resetFlag = ref(false)
// dialog flags
const dialog = ref(false)

function reset() {
  speed.value = defaults.value.speed
  damage.value = defaults.value.damage
  attack_zone.value = defaults.value.zone
}

function resetGame() {
  resetFlag.value = !resetFlag.value
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

watch(defaults, (nu, _) => {
  try {
    $q.localStorage.set(storage_key, nu)
  } catch (e) {
    console.log(`Error persisting defaults ${e}`)
  }
  
}, { deep: true})

</script>

<template>
  <Player :damage=damage :start="defaults.p1hp" :reset=resetFlag />
  <div class="row no-wrap">

    <div class="col self-center text-center"
      @click="hiOrLow($event, () => speed++, () => speed--)" 
      style="padding: 2vh; border: 2px solid green;">
      <h3 class="q-mx-none">{{speed}}
      <Element :element="attack_zone + ' attack'" /></h3>
    </div>
    <div class="self-center text-center col"
      :style="`padding: 2vh;`" 
      :class="`bg-${zoneColor(attack_zone)}`"
      @click="click3($event, () => attack_zone = 'high', () => attack_zone = 'mid', ()=> attack_zone = 'low')" >
      <h3 class="q-mx-none">
        {{attack_zone}}
      </h3>
    </div>
    <div class="col self-center text-center"
      @click="hiOrLow($event, () => damage++, () => damage--)" 
      style="padding: 2vh; border: 2px solid red;">
      <h3 class="q-mx-none">{{damage}}
      <Element :element="'damage'" /></h3>
    </div>
  </div>
  <Player :damage=damage :start="defaults.p2hp" :reset=resetFlag />
  <q-page-sticky position="bottom-right" :offset="[18, 18]">
    <q-btn :fab="true" icon="settings" color="primary" @click="dialog = true"/>
  </q-page-sticky>
  <q-dialog v-model="dialog">
    <q-card>
      <q-card-section>
        <div class="text-h6">Starting life totals</div>
        <q-input v-model.number="defaults.p1hp" label="Player 1" stack-label type="number" />
        <q-input v-model.number="defaults.p2hp" label="Player 2" stack-label type="number" />
        <q-btn class="flex-center" @click="resetGame()" color="negative">Reset game</q-btn>
      </q-card-section>
      <q-card-section>
        <div class="text-h6">Starting attack stats</div>
        <q-input v-model.number="defaults.speed" label="Starting speed" stack-label type="number" />
        <div class="q-gutter-sm"> 
          <q-radio v-model="defaults.zone" val="high" label="High" />
          <q-radio v-model="defaults.zone" val="mid" label="Mid" />
          <q-radio v-model="defaults.zone" val="low" label="Low" />
        </div>
        <q-input v-model.number="defaults.damage" label="Starting damage" stack-label type="number" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
