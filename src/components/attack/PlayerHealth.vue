<script setup>
import CounterBox from "src/components/attack/CounterBox.vue";

const props = defineProps({
  // TODO really ought to have one big player store and pass these a key like "player1"
  store: Object,
  // TODO move 'current damage' into Pinia state
  damage: Number,
  label: String,
});
const emitChangeLabel = "healthChange";
const emit = defineEmits(["healthChange"]);

// FIXME: duplicate logic with the store's halving
function half(x) {
  return (x % 2) + ((x / 2) | 0);
}

function undo() {
  props.store.undo();
}
</script>

<template>
  <div id="playerhealth">
    <CounterBox class="health" @up="store.increment" @down="store.decrement">
      <h2 class="text-center">{{ label }}<br />{{ store.health }}</h2>
    </CounterBox>
    <q-btn
      push
      class="playerbutton"
      color="positive"
      text-color="black"
      @click="undo()"
      >Undo {{ store.lastHit }}</q-btn
    >
    <q-btn
      push
      class="playerbutton"
      style="background: hsl(360, 100%, 73%)"
      text-color="black"
      @click="store.partialBlock(props.damage)"
      >Half ({{ half(props.damage) }})</q-btn
    >
    <q-btn
      push
      class="playerbutton"
      style="background: hsl(360, 100%, 43%)"
      text-color="black"
      @click="store.unblocked(props.damage)"
      >Hit ({{ props.damage }})</q-btn
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
