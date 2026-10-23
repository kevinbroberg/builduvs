<script setup>
// The tray's quick add: search every card by name and emit the one picked. Like
// the board, it's one entry per name (newest printing, front sides only), so a
// reprint doesn't show up as several choices.
import { ref } from 'vue'
import Fuse from 'fuse.js'
import { cards } from 'src/js/card_provider'
import { isBackSide } from 'src/stores/tiers'
import { getCardImage } from 'src/js/image_helper'

const emit = defineEmits(['pick'])

let fuse = null
function index() {
  if (!fuse) {
    const seen = new Set()
    const unique = cards.filter(c => !isBackSide(c) && !seen.has(c.name) && seen.add(c.name))
    fuse = new Fuse(unique, { keys: ['name'], threshold: 0.4 })
  }
  return fuse
}

const options = ref([])
// Empty the box after each pick, so several cards can go in one after another.
const field = ref(null)
function onPick(card) {
  if (!card) return
  emit('pick', card)
  field.value?.updateInputValue('', true)
  options.value = []
}
function filterFn(val, update) {
  update(() => {
    const needle = val.trim()
    options.value = needle ? index().search(needle, { limit: 20 }).map(r => r.item) : []
  })
}
</script>

<template>
  <q-select ref="field" class="tier-quick-add" dense outlined use-input hide-selected hide-dropdown-icon
    :model-value="null" :options="options" option-label="name" input-debounce="150"
    placeholder="Quick add…" @filter="filterFn" @update:model-value="onPick">
    <template #prepend><q-icon name="add" size="18px" /></template>
    <template #option="{ opt, itemProps }">
      <q-item v-bind="itemProps" dense>
        <q-item-section avatar>
          <q-img :src="getCardImage(opt.asset)" :ratio="59 / 86" width="28px" fit="contain" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ opt.name }}</q-item-label>
          <q-item-label caption>{{ opt.type }} · {{ opt.extension_short || opt.extension }}</q-item-label>
        </q-item-section>
      </q-item>
    </template>
    <template #no-option>
      <q-item dense><q-item-section class="text-grey">No matches</q-item-section></q-item>
    </template>
  </q-select>
</template>

<style scoped>
.tier-quick-add {
  width: 200px;
  font-weight: 400;
}
.tier-quick-add :deep(.q-field__control),
.tier-quick-add :deep(.q-field__marginal) {
  height: 30px;
  min-height: 30px;
}
.tier-quick-add :deep(.q-field__native) {
  min-height: 30px;
  padding: 0;
}
</style>
