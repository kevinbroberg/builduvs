<script setup>
import { computed } from "vue";
import CounterBox from "src/components/attack/CounterBox.vue";
import { useGameStore } from "src/stores/game";
import { calculateHalfDamage } from "src/utils/damage";

const props = defineProps({
  playerKey: String, // "player1" or "player2"
  damage: Number,
});

const game = useGameStore();
const player = computed(() => game[props.playerKey]);
const lastHit = computed(() =>
  props.playerKey === "player1" ? game.player1LastHit : game.player2LastHit
);

function increment() {
  if (props.playerKey === "player1") {
    game.incrementPlayer1();
  } else {
    game.incrementPlayer2();
  }
}

function decrement() {
  if (props.playerKey === "player1") {
    game.decrementPlayer1();
  } else {
    game.decrementPlayer2();
  }
}

function undo() {
  if (props.playerKey === "player1") {
    game.undoPlayer1();
  } else {
    game.undoPlayer2();
  }
}

function partialBlock() {
  if (props.playerKey === "player1") {
    game.player1PartialBlock(props.damage);
  } else {
    game.player2PartialBlock(props.damage);
  }
}

function unblocked() {
  if (props.playerKey === "player1") {
    game.player1Unblocked(props.damage);
  } else {
    game.player2Unblocked(props.damage);
  }
}
</script>

<template>
  <div id="playerhealth">
    <CounterBox class="health" @up="increment" @down="decrement">
      <h2 class="text-center">{{ player.name }}<br />{{ player.health }}</h2>
    </CounterBox>
    <q-btn
      push
      class="playerbutton"
      color="positive"
      text-color="black"
      @click="undo()"
      >Undo {{ lastHit }}</q-btn
    >
    <q-btn
      push
      class="playerbutton"
      style="background: hsl(360, 100%, 73%)"
      text-color="black"
      @click="partialBlock()"
      >Half ({{ calculateHalfDamage(damage) }})</q-btn
    >
    <q-btn
      push
      class="playerbutton"
      style="background: hsl(360, 100%, 43%)"
      text-color="black"
      @click="unblocked()"
      >Hit ({{ damage }})</q-btn
    >
  </div>
</template>

<style>
#playerhealth {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: 3fr 1fr;
}
.health {
  grid-column: span 3 / auto;
}
.playerbutton {
  grid-column: span 1 / auto;
}
</style>
