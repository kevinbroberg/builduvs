<script setup>
// The tray's quick add: search every card by name and emit the one picked. Like
// the board, it's one entry per name (newest printing, front sides only), so a
// reprint doesn't show up as several choices.
import { ref } from 'vue'
import { cards } from 'src/js/card_provider'
import { createCardSearch, FUZZY_DELAY_MS } from 'src/js/card_search'
import { isBackSide } from 'src/stores/tiers'
import { getCardImage } from 'src/js/image_helper'

const emit = defineEmits(['pick'])

let search = null
function index() {
  if (!search) {
    const seen = new Set()
    const unique = cards.filter(c => !isBackSide(c) && !seen.has(c.name) && seen.add(c.name))
    search = createCardSearch(unique)
  }
  return search
}

const options = ref([])
const find = (needle, fuzzyExtras) =>
  index().search(needle, { limit: 20, fuzzyExtras }).map(r => r.item)
// Fuzzy extras join the list once typing pauses.
let lateFuzzy = null
// Empty the box after each pick, so several cards can go in one after another.
const field = ref(null)
function onPick(card) {
  if (!card) return
  emit('pick', card)
  clearTimeout(lateFuzzy)
  field.value?.updateInputValue('', true)
  options.value = []
}
function filterFn(val, update) {
  clearTimeout(lateFuzzy)
  const needle = val.trim()
  update(() => {
    options.value = needle ? find(needle, false) : []
  })
  if (needle) lateFuzzy = setTimeout(() => { options.value = find(needle, true) }, FUZZY_DELAY_MS)
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
