<script setup>
import { useQuasar } from "quasar";
import CounterBox from "src/components/attack/CounterBox.vue";
import { useGameStore } from "src/stores/game";

const $q = useQuasar();

const game = useGameStore();
const nextZone = { high: "mid", mid: "low", low: "high" };
function goNextZone() {
  game.setDefaultZone(nextZone[game.defaultZone]);
}
</script>

<template>
  <div class="q-pa-md">
    <div class="q-gutter-md" style="max-width: 300px">
      <div class="text-h6">
        Players
        <q-input
          :model-value="game.player1.name"
          @update:model-value="game.setPlayer1Name"
          label="Player 1"
          stack-label
          :rules="[(val) => val.length <= 15 || 'Maximum length 15']"
        />
        <CounterBox
          @up="game.incrementPlayer1StartingHealth()"
          @down="game.decrementPlayer1StartingHealth()"
        >
          <h5>
            {{ game.player1.name }} starting health: {{ game.player1.startingHealth }}
          </h5>
        </CounterBox>
        <q-btn
          push
          stack
          size="m"
          icon="restore_page"
          color="negative"
          @click="game.resetPlayer1()"
          >Reset {{ game.player1.name }} health ({{ game.player1.health }})
        </q-btn>
        <q-input
          :model-value="game.player2.name"
          @update:model-value="game.setPlayer2Name"
          label="Player 2"
          stack-label
          :rules="[(val) => val.length <= 15 || 'Maximum length 15']"
        />
        <CounterBox
          @up="game.incrementPlayer2StartingHealth()"
          @down="game.decrementPlayer2StartingHealth()"
        >
          <h5>
            {{ game.player2.name }} starting health: {{ game.player2.startingHealth }}
          </h5>
        </CounterBox>
      </div>
      <q-btn
        push
        stack
        size="m"
        icon="restore_page"
        color="negative"
        @click="game.resetPlayer2()"
        >Reset {{ game.player2.name }} health ({{ game.player2.health }})
      </q-btn>
      <div>
        <h6>Attack default</h6>
        <CounterBox
          class="speed"
          :class="game.defaultZone"
          @up="game.incrementDefaultSpeed()"
          @down="game.decrementDefaultSpeed()"
        >
          <h3>{{ game.defaultSpeed }}</h3>
        </CounterBox>
        <div
          class="zone text-center"
          :class="`${game.defaultZone}color`"
          @click="goNextZone"
        >
          <h4 class="q-mx-none">
            {{ game.defaultZone }}
          </h4>
        </div>
        <CounterBox
          class="damage"
          @up="game.incrementDefaultDamage()"
          @down="game.decrementDefaultDamage()"
        >
          <h3>{{ game.defaultDamage }}</h3>
        </CounterBox>
      </div>
    </div>
  </div>
</template>
