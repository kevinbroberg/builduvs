<script setup>
// Sort and filter controls for the tier maker's unranked tray. Edits apply live;
// the page owns the view object (see src/js/tier_pool_view.js).
import { computed } from 'vue'
import { poolViewOptions, defaultPoolView, activeFilterCount } from 'src/js/tier_pool_view'
import { TIER_EMOJI } from 'src/js/tier_emoji'

const open = defineModel('open', { type: Boolean, default: false })
const view = defineModel('view', { type: Object, required: true })

const props = defineProps({
  // Every card in scope, ranked or not, so the options don't shift as you rank.
  cards: { type: Array, required: true },
  // How many tray cards the current filters leave showing.
  shownCount: { type: Number, default: 0 },
})

const emit = defineEmits(['select-shown'])

const options = computed(() => poolViewOptions(props.cards))

// Symbols and zones get their game icon, by way of the tier-label emoji table.
function iconFor(filterKey, value) {
  if (filterKey === 'resources') return TIER_EMOJI[value]
  if (filterKey === 'attack_zone') return TIER_EMOJI[`attack_${value}`]
  if (filterKey === 'block_zone') return TIER_EMOJI[`block_${value}`]
  return null
}

function toggle(filterKey, value) {
  const list = view.value.picks[filterKey] ??= []
  const i = list.indexOf(value)
  if (i < 0) list.push(value)
  else list.splice(i, 1)
}

function reset() {
  view.value = defaultPoolView()
}
</script>

<template>
  <q-dialog v-model="open">
    <q-card style="width: 460px; max-width: 92vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6 col">Sort &amp; filter unranked</div>
        <q-btn flat round dense icon="close" v-close-popup />
      </q-card-section>

      <q-card-section class="q-gutter-y-md">
        <div class="row items-center no-wrap q-gutter-x-sm">
          <q-select v-model="view.sort" :options="options.sorts" option-value="key" option-label="label"
            emit-value map-options label="Sort by" outlined dense class="col" />
          <q-btn flat round :icon="view.desc ? 'arrow_downward' : 'arrow_upward'"
            :title="view.desc ? 'Descending' : 'Ascending'" @click="view.desc = !view.desc" />
        </div>

        <q-input v-model="view.search" label="Name or text contains" outlined dense clearable
          @clear="view.search = ''">
          <template #prepend><q-icon name="search" /></template>
        </q-input>

        <div v-for="f in options.filters" :key="f.key">
          <div class="text-caption text-grey-7 q-mb-xs">{{ f.label }}</div>
          <div class="row q-gutter-xs">
            <q-chip v-for="v in f.options" :key="v" clickable dense square
              :outline="!view.picks[f.key]?.includes(v)"
              :color="view.picks[f.key]?.includes(v) ? 'primary' : undefined"
              :text-color="view.picks[f.key]?.includes(v) ? 'white' : undefined"
              @click="toggle(f.key, v)">
              <img v-if="iconFor(f.key, v)" :src="iconFor(f.key, v)" :alt="v" class="pv-chip-icon" />
              {{ v }}
            </q-chip>
          </div>
        </div>
      </q-card-section>

      <q-card-actions>
        <q-btn flat no-caps icon="select_all" :label="`Select All ${shownCount}`" :disable="!shownCount"
          v-close-popup @click="emit('select-shown')" />
        <q-space />
        <q-btn flat no-caps label="Reset" :disable="!activeFilterCount(view) && view.sort === 'set' && !view.desc"
          @click="reset" />
        <q-btn unelevated no-caps color="primary" label="Done" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.pv-chip-icon {
  height: 1.3em;
  width: auto;
  margin-right: 4px;
}
</style>
