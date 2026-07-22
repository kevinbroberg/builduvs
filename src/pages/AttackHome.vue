<script setup>
import { ref } from "vue";
import { useQuasar } from "quasar";
import PlayerHealth from "src/components/attack/PlayerHealth.vue";
import CounterBox from "src/components/attack/CounterBox.vue";
import GameSettings from "src/components/attack/GameSettings.vue";
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
const configDialog = ref(false);
</script>

<template>
  <main class="attack-board">
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

    <q-fab
      class="fab"
      icon="menu"
      active-icon="close"
      direction="up"
      color="primary"
      vertical-actions-align="right"
      padding="md"
    >
      <q-fab-action
        color="positive"
        icon="restore_page"
        label="Reset attack"
        @click="resetAttack"
      />
      <q-fab-action
        color="negative"
        icon="replay"
        label="Reset game"
        @click="resetGame"
      />
      <q-fab-action
        color="black"
        icon="history"
        label="History"
        @click="dialog = true"
      />
      <q-fab-action
        color="secondary"
        icon="settings"
        label="Settings"
        @click="configDialog = true"
      />
    </q-fab>
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
    <q-dialog v-model="configDialog">
      <q-card class="config-dialog">
        <q-card-section>
          <GameSettings />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
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
.damage {
  border: 0.5ch solid black;
  justify-content: center;
  align-items: center;
  display: flex;
  flex-direction: column;
  padding: 1ch;
}
.zone {
  grid-column: span 2 / auto;
}
.fab {
  position: fixed;
  right: 2vw;
  bottom: 2vh;
  z-index: 10;
}
.config-dialog {
  width: 700px;
  max-width: 90vw;
}
.speed,
.damage,
.zone,
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
/* Scoped to the attack board's root element. This block is intentionally
   unscoped (GameSettings reuses .speed/.zone/.damage), so target a class
   instead of the bare `main` tag — QPage also renders as <main> and the
   grid was leaking onto every other page. */
.attack-board {
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
