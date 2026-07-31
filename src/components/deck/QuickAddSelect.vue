<script setup>
import { ref, computed } from 'vue'
import Fuse from 'fuse.js'
import { cards } from 'src/js/card_provider'
import { useDeckStore } from 'src/stores/deck'
import { getCardImage } from 'src/js/image_helper'

const props = defineProps({
  // Restrict the search pool to face characters (used by the empty-face state).
  charactersOnly: { type: Boolean, default: false },
  label: { type: String, default: 'Quick Add' },
})

const deckStore = useDeckStore()

// Local index so quick-add searching never touches the card browser's filters.
const pool = computed(() =>
  props.charactersOnly ? cards.filter(c => c.type === 'character') : cards
)
const fuse = computed(() => new Fuse(pool.value, { keys: ['name'], threshold: 0.4 }))

const options = ref([])

function filterFn(val, update) {
  update(() => {
    const needle = val.trim()
    if (needle.length === 0) {
      options.value = []
    } else {
      options.value = fuse.value.search(needle, { limit: 20 }).map(r => r.item)
    }
  })
}

function onPick(card) {
  if (!card) return
  deckStore.increment(card)
}
</script>

<template>
  <q-select
    class="quick-add"
    dense
    outlined
    use-input
    hide-selected
    fill-input
    hide-dropdown-icon
    :model-value="null"
    :options="options"
    option-label="name"
    input-debounce="200"
    :label="label"
    placeholder="Search by name…"
    @filter="filterFn"
    @update:model-value="onPick"
  >
    <template v-slot:prepend>
      <q-icon name="search" />
    </template>

    <template v-slot:option="scope">
      <q-item v-bind="scope.itemProps">
        <q-item-section avatar>
          <q-img
            :src="getCardImage(scope.opt.asset)"
            :ratio="59 / 86"
            width="34px"
            fit="contain"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ scope.opt.name }}</q-item-label>
          <q-item-label caption>
            {{ scope.opt.type }} · {{ scope.opt.extension_short || scope.opt.extension }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </template>

    <template v-slot:no-option>
      <q-item>
        <q-item-section class="text-grey">No matches</q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<style scoped>
.quick-add {
  min-width: 220px;
}
</style>
