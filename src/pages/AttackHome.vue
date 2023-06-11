<script setup>
import { ref, watch } from "vue";
import { useQuasar } from "quasar";
import PlayerHealth from "src/components/attack/PlayerHealth.vue";
import CounterBox from "src/components/attack/CounterBox.vue";
import { usePlayer1Store, usePlayer2Store } from "src/stores/players";

const $q = useQuasar();

const p1 = usePlayer1Store();
const p2 = usePlayer2Store();

const storage_key = "attack_default";
const default_defaults = {
  speed: 4,
  damage: 5,
  p1hp: 30,
  p1name: "Me",
  p2hp: 30,
  p2name: "You",
  zone: "mid",
};
const initial_defaults =
  $q.localStorage?.getItem(storage_key) || default_defaults;

const settings = ref(initial_defaults);
const speed = ref(settings.value.speed);
const damage = ref(settings.value.damage);
const attack_zone = ref(settings.value.zone);

// const resetFlag = ref(false);
// dialog flags
const dialog = ref(false);

function resetAttack() {
  speed.value = settings.value.speed;
  damage.value = settings.value.damage;
  attack_zone.value = settings.value.zone;
}

function resetGame() {
  p1.reset();
  p2.reset();
}

const nextZone = { high: "mid", mid: "low", low: "high" };
function goNextZone() {
  attack_zone.value = nextZone[attack_zone.value];
}

watch(
  settings,
  (nu, _) => {
    try {
      $q.localStorage.set(storage_key, nu);
    } catch (e) {
      console.log(`Error persisting settings ${e}`);
    }
  },
  { deep: true }
);
</script>

<template>
  <main>
    <PlayerHealth
      class="player"
      :store="p1"
      :damage="damage"
      :start="settings.p1hp"
      :zone="attack_zone"
      :label="settings.p1name"
    />
    <PlayerHealth
      class="player"
      :store="p2"
      :damage="damage"
      :start="settings.p2hp"
      :zone="attack_zone"
      :label="settings.p2name"
    />

    <CounterBox
      class="speed"
      :class="attack_zone"
      @up="speed++"
      @down="speed--"
    >
      <h3>{{ speed }}</h3>
    </CounterBox>
    <div
      class="zone text-center"
      :class="`${attack_zone}color`"
      @click="goNextZone"
    >
      <h4 class="q-mx-none">
        {{ attack_zone }}
      </h4>
    </div>
    <CounterBox class="damage" @up="damage++" @down="damage--">
      <h3>{{ damage }}</h3>
    </CounterBox>

    <div class="options">
      <q-btn
        push
        size="xl"
        color="positive"
        @click="resetAttack"
        v-touch-hold.mouse="resetGame"
        >Reset attack
        <q-tooltip>Hold to reset game</q-tooltip>
      </q-btn>
      <q-btn push size="xl" color="black" icon="settings" @click="dialog = true"
        >History</q-btn
      >
    </div>

    <!-- <q-page-sticky position="bottom-right" :offset="[18, 18]">
    <q-btn :fab="true" icon="settings_backup_restore" color="green" @click="resetAttack()">
      <q-tooltip>Reset attack to default</q-tooltip>
    </q-btn>
    <q-btn :fab="true" icon="settings" color="primary" @click="dialog = true">
      <q-tooltip>Damage history</q-tooltip>
    </q-btn>
  </q-page-sticky> -->
    <q-dialog v-model="dialog">
      <q-card>
        <q-card-section>
          <div class="text-h5">Life total history</div>
          <div class="row justify-between">
            <div class="column">
              <h6>Player 1</h6>
              <p v-for="c in p1.history" :key="c">
                {{ c.value }} {{ c.title }}
              </p>
            </div>
            <!-- TODO should be a component -->
            <div class="column text-right">
              <h6>Player 2</h6>
              <p v-for="c in p2.history" :key="c">
                {{ c.value }} {{ c.title }}
              </p>
            </div>
          </div>
          <q-btn class="flex-center" @click="resetGame" color="negative"
            >Reset game</q-btn
          >
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
.zone,
.speed,
.damage,
.options {
  border: 0.5ch solid black;
  justify-content: center;
  align-items: center;
  display: flex;
  flex-direction: column;
  padding: 1ch;
}
.speed,
.damage,
.zone,
.options,
.high,
.mid,
.low {
  background-repeat: no-repeat;
  background-size: contain;
  background-position: 50% center;

  user-select: none; /* don't highlight text */
  height: 75%;
  width: 100%;
}
.high,
.mid,
.low {
  background-position: 55% center;
}
.damage {
  /* padding: 2vh;  */
  border: 0.5ch solid black;
  background-image: url("assets/damage.png");
  grid-column: span 2 / auto;
}
.lowcolor {
  background-color: hsl(53, 91%, 55%);
}
.highcolor {
  background-color: hsl(359, 85%, 53%);
}
.midcolor {
  background-color: hsl(28, 93%, 58%);
}
.high {
  background-image: url("assets/high attack.png");
}
.mid {
  background-image: url("assets/mid attack.png");
}
.low {
  background-image: url("assets/low attack.png");
}
main {
  margin-top: 5vh;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-template-rows: 40vh 40vh;
  justify-content: center;
  align-items: center;
  user-select: none; /* don't highlight text */
  box-sizing: border-box;
}
</style>
