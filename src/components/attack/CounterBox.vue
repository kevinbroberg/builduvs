<script setup>
const emit = defineEmits(["up", "down"]);
</script>

<template>
  <div class="enclose">
    <slot></slot>
    <div class="upper" @click="emit('up')" />
    <div class="lower" @click="emit('down')" />
  </div>
</template>

<style>
.enclose {
  border: 0.5ch solid black;
  position: relative;
  justify-content: center;
  align-items: center;
}
.upper {
  position: absolute;
  top: 0;
  background-color: coral;
  opacity: 0;
  z-index: 1;
  height: 50%;
  width: 100%;
}
.lower {
  position: absolute;
  bottom: 0;
  background-color: aquamarine;
  opacity: 0;
  z-index: 1;
  height: 50%;
  width: 100%;
}
.upper:hover,
.lower:hover {
  opacity: 0.1;
}
.upper:active,
.lower:active {
  opacity: 0.3;
}
</style>
