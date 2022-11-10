<script setup>
import { ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import Player from 'src/components/attack/Player.vue'
import Counter from 'src/components/attack/Counter.vue'
import Element from 'components/cards/detail/Element.vue'

const $q = useQuasar()

const storage_key = "attack_default"
const default_defaults = { speed: 4 , damage: 5, p1hp: 30, p1name:"Me", p2hp: 30, p2name: "You", zone: 'mid'}
const initial_defaults = $q.localStorage?.getItem(storage_key) || default_defaults

const settings = ref(initial_defaults)
const speed = ref(settings.value.speed)
const damage = ref(settings.value.damage)
const attack_zone = ref(settings.value.zone)

// Players watch this to determine when to reset
const resetFlag = ref(false)
// dialog flags
const dialog = ref(false)

function resetAttack() {
  speed.value = settings.value.speed
  damage.value = settings.value.damage
  attack_zone.value = settings.value.zone
}

const history = ref({ p1: [], p2:[] })
function delta(list) {
  // this seems kinda overengineered tbh
  return (x) => {
    if (x == -1) {
      let last = list.pop()
      if (last < 0) {
        last = last - 1
        list.push(last)
      } else {
        // don't push undefined
        if (last) list.push(last)
        list.push(x)
      }
    } else {
      list.push(x)
    }
  }
}
function p1change(x) {
  delta(history.value.p1)(x)
}
function p2change(x) {
  delta(history.value.p2)(x)
}

function resetGame() {
  resetFlag.value = !resetFlag.value
  resetAttack()
  history.value = { p1: [], p2:[] }
}

const nextZone = {'high': 'mid', 'mid': 'low', 'low': 'high'}
function goNextZone() {
  attack_zone.value = nextZone[attack_zone.value]
}

watch(settings, (nu, _) => {
  try {
    $q.localStorage.set(storage_key, nu)
  } catch (e) {
    console.log(`Error persisting settings ${e}`)
  }
}, { deep: true })

</script>

<template>
  <main>
    <Player class="player" :damage=damage :start="settings.p1hp" :zone="attack_zone" :label="settings.p1name" :reset=resetFlag @healthChange=p1change />
    <Player class="player" :damage=damage :start="settings.p2hp" :zone="attack_zone" :label="settings.p2name" :reset=resetFlag @healthChange=p2change />

    
    <Counter class="speed" :class="attack_zone" @up="speed++" @down="speed--">
      <h3>{{speed}}</h3>
    </Counter>
    <!-- TODO sometime soon: replace with divs rather than click3() function -->
    <div class="zone text-center"
      :class="`${attack_zone}color`"
      @click=goNextZone >
      <h4 class="q-mx-none">
        {{attack_zone}}
      </h4>
    </div>
    <Counter class="damage" @up="damage++" @down="damage--">
      <h3>{{damage}}</h3>
    </Counter>
  
  <q-page-sticky position="bottom-right" :offset="[18, 18]">
    <q-btn :fab="true" icon="settings_backup_restore" color="green" @click="resetAttack()">
      <q-tooltip>Reset attack to default</q-tooltip>
    </q-btn>
    <q-btn :fab="true" icon="settings" color="primary" @click="dialog = true">
      <q-tooltip>Damage history</q-tooltip>
    </q-btn>
  </q-page-sticky>
  <q-dialog v-model="dialog">
    <q-card>
      <q-card-section>
        <q-btn class="flex-center" @click="resetGame()" color="negative">Reset game</q-btn>
        <div class="text-h6">Life total history </div>
        <div class="row justify-between">
          <div class="column">
            <p>Player 1</p>
            <p v-for="c in history.p1" :key="c">{{c}}</p>
          </div>
          <div class="column text-right">
            <p>Player 2</p>
            <p v-for="c in history.p2" :key="c">{{c}}</p>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
  </main>
</template>

<style>
.player {
  /* I'd really think player{} should work... */
  grid-column: span 3 / auto;
  padding: 0.5ch;
}
.speed {
  /* padding: 2vh;  */
  border: 0.5ch solid black;
  grid-column: span 2 / auto;
}
.zone {
  border: 0.5ch solid black;
  grid-column: span 1;
}
.speed, .damage, .high, .mid, .low {
  background-repeat: no-repeat;
  background-size: contain;
  background-position: 50% center;
  display: flex; 
  flex-direction: column;
}
.high, .mid, .low {
  background-position: 55% center;
}
.damage {
  /* padding: 2vh;  */
  border: 0.5ch solid black;
  background-image: url(~assets/images/damage.png);
  grid-column: span 3 / auto;
}
.lowcolor {
  background-color: hsl(53, 91%, 55%)
}
.highcolor {
  background-color: hsl(359, 85%, 53%)
}
.midcolor {
  background-color: hsl(28, 93%, 58%)
}
.high {
  background-image: url(~assets/images/high attack.png);
}
.mid {
  background-image: url(~assets/images/mid attack.png);
}
.low {
  background-image: url(~assets/images/low attack.png);
}
main {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-template-rows: 40vh 40vh;
  justify-content: center;
  align-items: center;
  user-select: none; /* don't highlight text */
  box-sizing: border-box;
}
</style>