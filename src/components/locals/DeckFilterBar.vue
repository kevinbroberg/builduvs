<script setup>
import { ref, computed } from 'vue'
import { getCardImage } from 'src/js/image_helper'
import { ALL_ELEMENTS, CONFUSED_SYMBOL } from 'src/js/deck_symbol'

const MODES = [
  { label: 'Card in deck', value: 'card' },
  { label: 'Main character', value: 'character' },
]

const props = defineProps({
  mode: { type: String, default: 'card' },       // 'card' | 'character'
  card: { type: Object, default: null },         // selected card { name, cardeio_id, asset, type } or null
  cardOptions: { type: Array, default: () => [] }, // full standard-card list to search against
  elements: { type: Array, default: () => [] },  // selected element toggles (ALL_ELEMENTS + 'confused')
  sortBy: { type: String, default: 'finish' },   // 'finish' | 'date'
  resultCount: { type: Number, default: 0 },
  eventCount: { type: Number, default: 0 },
  // Most-played cards for the active tab/mode (see LocalsPage's popularCards),
  // shown in place of the plain "type to search" placeholder so there's
  // something to browse before typing anything.
  popularCards: { type: Array, default: () => [] },
  // cardeio_id (or name, for cards lacking one) -> deckCount, for annotating
  // typed search results with the same play-count popularCards shows.
  popularityByKey: { type: Object, default: () => new Map() },
})

const emit = defineEmits(['update:mode', 'update:card', 'update:elements', 'update:sortBy', 'clear', 'request-popular'])

// The raw text currently typed into the search box — the only thing @filter
// actually needs to record. The option list itself is a computed over this
// plus the popularity props, so it always reflects the latest data (e.g. a
// popularity refetch landing after a tab switch) rather than a one-shot
// snapshot frozen at the moment @filter last fired.
const queryText = ref('')
const showingPopular = computed(() => !normName(queryText.value))

function normName(s) {
  return (s || '').toLowerCase().replace(/[‘’‚‛′]/g, "'")
}

// "Main character" mode only makes sense searching face cards — narrow the
// autocomplete pool so picking a mode switches what you can even type.
const searchPool = computed(() =>
  props.mode === 'character' ? props.cardOptions.filter((c) => c.type === 'character') : props.cardOptions
)

const filteredCardOptions = computed(() => {
  const q = normName(queryText.value)
  if (!q) return props.popularCards
  return searchPool.value
    .filter((c) => normName(c.name).includes(q))
    .map((c) => ({ ...c, deckCount: props.popularityByKey.get(c.cardeio_id || c.name) ?? 0 }))
    .sort((a, b) => b.deckCount - a.deckCount)
    .slice(0, 40)
})

function filterCards(val, update) {
  update(() => { queryText.value = val })
}

function setMode(mode) {
  if (mode === props.mode) return
  emit('update:mode', mode)
  // a card picked under the other mode no longer applies (e.g. a non-character
  // card can't be a "main character" filter)
  emit('update:card', null)
}

const modeLabel = computed(() => MODES.find((m) => m.value === props.mode)?.label ?? 'Card in deck')
const cardPlaceholder = computed(() => props.mode === 'character' ? 'Search for a character…' : 'Search for a card…')
const chipLabel = computed(() => `${modeLabel.value}: ${props.card?.name ?? ''}`)

function toggleElement(el) {
  const set = new Set(props.elements)
  if (set.has(el)) set.delete(el)
  else set.add(el)
  emit('update:elements', [...set])
}

const hasFilters = computed(() => !!props.card || props.elements.length > 0)

const SORT_OPTIONS = [
  { label: 'Best finish', value: 'finish' },
  { label: 'Most recent', value: 'date' },
]
const sortLabel = computed(() => SORT_OPTIONS.find((o) => o.value === props.sortBy)?.label ?? 'Sort')
</script>

<template>
  <div class="deck-filter-bar">
    <div class="row items-center q-gutter-sm q-pa-sm">
      <q-select
        dense
        outlined
        emit-value
        map-options
        bg-color="white"
        class="filter-mode"
        :model-value="mode"
        :options="MODES"
        @update:model-value="setMode"
      />

      <q-select
        dense
        outlined
        use-input
        hide-selected
        fill-input
        input-debounce="150"
        bg-color="white"
        class="filter-card-search col"
        :placeholder="cardPlaceholder"
        :model-value="card"
        :options="filteredCardOptions"
        option-label="name"
        @filter="filterCards"
        @popup-show="emit('request-popular')"
        @update:model-value="(v) => emit('update:card', v)"
      >
        <template v-slot:prepend><q-icon name="search" size="xs" /></template>
        <template v-slot:before-options v-if="showingPopular && filteredCardOptions.length">
          <q-item dense><q-item-section class="text-caption text-grey-6">Most played</q-item-section></q-item>
        </template>
        <template v-slot:option="scope">
          <q-item v-bind="scope.itemProps">
            <q-item-section avatar style="min-width: 32px">
              <img v-if="scope.opt.asset" :src="getCardImage(scope.opt.asset)" class="option-thumb" />
            </q-item-section>
            <q-item-section>{{ scope.opt.name }}</q-item-section>
            <q-item-section v-if="scope.opt.deckCount != null" side class="text-caption text-grey-6">
              {{ scope.opt.deckCount }} {{ scope.opt.deckCount === 1 ? 'deck' : 'decks' }}
            </q-item-section>
          </q-item>
        </template>
        <template v-slot:no-option>
          <q-item><q-item-section class="text-grey-6">{{ mode === 'character' ? 'Type a character name…' : 'Type a card name…' }}</q-item-section></q-item>
        </template>
      </q-select>

      <div class="row items-center q-gutter-xs element-toggles">
        <q-btn
          v-for="el in ALL_ELEMENTS"
          :key="el"
          round
          dense
          size="sm"
          :flat="!elements.includes(el)"
          :color="elements.includes(el) ? 'primary' : 'grey-4'"
          class="element-toggle"
          @click="toggleElement(el)"
        >
          <q-icon :name="`img:` + (getSymbolIcon(el) || '')" size="20px" />
          <q-tooltip :delay="300">{{ el }}</q-tooltip>
        </q-btn>
        <q-btn
          round
          dense
          size="sm"
          :flat="!elements.includes(CONFUSED_SYMBOL)"
          :color="elements.includes(CONFUSED_SYMBOL) ? 'primary' : 'grey-4'"
          class="element-toggle"
          icon="help_outline"
          @click="toggleElement(CONFUSED_SYMBOL)"
        >
          <q-tooltip :delay="300">Mixed</q-tooltip>
        </q-btn>
      </div>

      <q-space />

      <q-select
        dense
        outlined
        emit-value
        map-options
        bg-color="white"
        class="filter-sort"
        :model-value="sortBy"
        :options="SORT_OPTIONS"
        @update:model-value="(v) => emit('update:sortBy', v)"
      >
        <template v-slot:selected>
          <span class="text-caption text-grey-7">Sort <strong>{{ sortLabel }}</strong></span>
        </template>
      </q-select>
    </div>

    <div v-if="hasFilters" class="row items-center q-gutter-sm q-px-sm q-pb-sm">
      <span class="text-body2 text-grey-8">
        <strong>{{ resultCount }}</strong> {{ resultCount === 1 ? 'deck' : 'decks' }}
        across <strong>{{ eventCount }}</strong> {{ eventCount === 1 ? 'event' : 'events' }}
      </span>
      <q-chip v-if="card" removable dense color="orange-1" text-color="orange-9" class="filter-chip"
        @remove="emit('update:card', null)">
        {{ chipLabel }}
      </q-chip>
      <q-chip v-for="el in elements" :key="el" removable dense color="orange-1" text-color="orange-9" class="filter-chip"
        @remove="toggleElement(el)">
        {{ el === CONFUSED_SYMBOL ? 'Mixed' : el }}
      </q-chip>
      <q-space />
      <a href="#" class="text-primary text-body2 clear-all" @click.prevent="emit('clear')">Clear all</a>
    </div>
  </div>
</template>

<script>
import { getSymbolImage } from 'src/js/image_helper'
export default {
  methods: {
    getSymbolIcon(name) { return getSymbolImage(name) },
  },
}
</script>

<style scoped>
.deck-filter-bar { background: white; border-bottom: 1px solid rgba(0, 0, 0, 0.08); }
.filter-mode { width: 150px; }
.filter-mode :deep(.q-field__native) { cursor: default; }
.filter-card-search { min-width: 220px; }
.filter-sort { width: 150px; }
.element-toggle { opacity: 0.85; }
.element-toggle.text-primary, .element-toggle[color='primary'] { opacity: 1; }
.option-thumb { width: 28px; height: 28px; object-fit: cover; object-position: top; border-radius: 3px; }
.filter-chip { font-weight: 600; }
.clear-all { text-decoration: none; }
.clear-all:hover { text-decoration: underline; }

@media (max-width: 900px) {
  .element-toggles { order: 1; flex-basis: 100%; }
}
</style>
