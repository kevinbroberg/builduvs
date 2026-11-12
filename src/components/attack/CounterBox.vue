<script setup>
// Tap the top half to go up, the bottom half to go down. A drag that starts in
// one half and ends in the other is a swipe: bottom→top emits "swipe-up",
// top→bottom emits "swipe-down". Parents that don't listen for swipes just
// ignore them (a swipe never also counts as a tap). Swipes are opt-in via the
// `swipe` prop: enabling them disables touch scrolling over the box.
const props = defineProps({ swipe: Boolean });
const emit = defineEmits(["up", "down", "swipe-up", "swipe-down"]);

// Minimum vertical travel (px) before a cross-half drag counts as a swipe, so a
// tap that happens to land on the midline doesn't fire one.
const SWIPE_MIN_PX = 24;

let start = null; // { y, half, id }

function halfAt(el, clientY) {
  const r = el.getBoundingClientRect();
  return clientY < r.top + r.height / 2 ? "upper" : "lower";
}

function onDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  const el = e.currentTarget;
  start = { y: e.clientY, half: halfAt(el, e.clientY), id: e.pointerId };
  // Keep receiving the pointer even if the finger slides off the box.
  try {
    el.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
}

function onUp(e) {
  if (!start || e.pointerId !== start.id) return;
  const s = start;
  start = null;
  const endHalf = halfAt(e.currentTarget, e.clientY);
  const dy = e.clientY - s.y;
  if (props.swipe && endHalf !== s.half && Math.abs(dy) >= SWIPE_MIN_PX) {
    emit(dy < 0 ? "swipe-up" : "swipe-down");
  } else if (endHalf === s.half) {
    emit(s.half === "upper" ? "up" : "down");
  }
}

function onCancel() {
  start = null;
}
</script>

<template>
  <div
    class="enclose"
    :class="{ swipeable: swipe }"
    @pointerdown="onDown"
    @pointerup="onUp"
    @pointercancel="onCancel"
  >
    <slot></slot>
    <div class="upper" />
    <div class="lower" />
  </div>
</template>

<style scoped>
.enclose {
  border: 0.5ch solid black;
  position: relative;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}
/* Stop the browser from claiming vertical drags as page scroll, which would
   cancel the pointer before a swipe can finish. */
.swipeable {
  touch-action: none;
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
