<script setup>
// A button that opens a grid of the tier-label icons and emits the picked :name:.
import { TIER_EMOJI } from 'src/js/tier_emoji'

const emit = defineEmits(['pick'])
const names = Object.keys(TIER_EMOJI)
</script>

<template>
  <q-btn flat round dense size="sm" icon="add_reaction" aria-label="Insert icon" title="Insert icon">
    <q-menu anchor="bottom right" self="top right">
      <div class="emoji-grid q-pa-sm">
        <button v-for="name in names" :key="name" v-close-popup type="button"
          class="emoji-grid__btn" :title="`:${name}:`" @click="emit('pick', name)">
          <img :src="TIER_EMOJI[name]" :alt="`:${name}:`" />
        </button>
      </div>
    </q-menu>
  </q-btn>
</template>

<style scoped>
.emoji-grid {
  display: grid;
  grid-template-columns: repeat(6, 36px);
  gap: 4px;
}
.emoji-grid__btn {
  width: 36px;
  height: 36px;
  padding: 4px;
  border: 0;
  border-radius: 6px;
  background: none;
  cursor: pointer;
}
.emoji-grid__btn:hover { background: rgba(127, 127, 127, 0.18); }
.emoji-grid__btn img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
