<script setup>
import CounterBox from "src/components/attack/CounterBox.vue";

const props = defineProps({
  start: Number,
  store: Object,
  damage: Number,
  zone: String,
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
  <div>
    <CounterBox @up="store.increment" @down="store.decrement">
      <h2 class="text-center">{{ label }}: {{ store.health }}</h2>
    </CounterBox>
    <div class="row justify-end">
      <q-btn
        class="col"
        push
        size="xl"
        color="positive"
        text-color="black"
        @click="undo()"
        >Undo {{ store.lastHit }}</q-btn
      >
      <q-btn
        class="col"
        push
        size="xl"
        style="background: hsl(360, 100%, 73%)"
        text-color="black"
        @click="store.partialBlock(props.damage)"
        >Take half ({{ half(props.damage) }})</q-btn
      >
      <q-btn
        class="col"
        push
        size="xl"
        style="background: hsl(360, 100%, 43%)"
        text-color="black"
        @click="store.unblocked(props.damage)"
        >Take full ({{ props.damage }})</q-btn
      >
    </div>
  </div>
</template>
