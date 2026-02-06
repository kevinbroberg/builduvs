<script setup>
import { ref } from "vue";
import { useQuasar } from "quasar";
import PlayerHealth from "src/components/attack/PlayerHealth.vue";
import CounterBox from "src/components/attack/CounterBox.vue";
import { useGameStore } from "src/stores/game";

const $q = useQuasar();

const game = useGameStore();

// Local state for CURRENT attack (separate from defaults in config)
const currentSpeed = ref(game.defaultSpeed);
const currentDamage = ref(game.defaultDamage);
const currentZone = ref(game.defaultZone);

function resetAttack() {
  currentSpeed.value = game.defaultSpeed;
  currentDamage.value = game.defaultDamage;
  currentZone.value = game.defaultZone;
}

function resetGame() {
  game.resetPlayer1();
  game.resetPlayer2();
}

const nextZone = { high: "mid", mid: "low", low: "high" };
function goNextZone() {
  currentZone.value = nextZone[currentZone.value];
}

const dialog = ref(false);
</script>

<template>
  <main>
    <PlayerHealth
      class="player"
      player-key="player1"
      :damage="currentDamage"
    />
    <PlayerHealth
      class="player"
      player-key="player2"
      :damage="currentDamage"
    />

    <CounterBox
      class="speed"
      :class="currentZone"
      @up="currentSpeed++"
      @down="currentSpeed--"
    >
      <h3>{{ currentSpeed }}</h3>
    </CounterBox>
    <div
      class="zone text-center"
      :class="`${currentZone}color`"
      @click="goNextZone"
    >
      <h4 class="q-mx-none">
        {{ currentZone }}
      </h4>
    </div>
    <CounterBox class="damage" @up="currentDamage++" @down="currentDamage--">
      <h3>{{ currentDamage }}</h3>
    </CounterBox>

    <div class="options">
      <q-btn
        push
        stretch
        stack
        size="m"
        icon="restore_page"
        color="positive"
        @click="resetAttack"
        v-touch-hold.mouse="resetGame"
        >Reset
        <q-tooltip>Hold to reset game</q-tooltip>
      </q-btn>
      <q-btn
        push
        stretch
        stack
        size="m"
        color="black"
        icon="history"
        @click="dialog = true"
        >History</q-btn
      >
    </div>
    <q-dialog v-model="dialog">
      <q-card>
        <q-card-section>
          <div class="text-h5">Life total history</div>
          <div class="row justify-between">
            <div class="column">
              <h6>{{ game.player1.name }}</h6>
              <p v-for="c in game.player1.history" :key="c">
                {{ c.value }} {{ c.title }}
              </p>
            </div>
            <div class="column text-right">
              <h6>{{ game.player2.name }}</h6>
              <p v-for="c in game.player2.history" :key="c">
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
