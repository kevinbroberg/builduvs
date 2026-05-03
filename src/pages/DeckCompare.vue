<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useDeckStore } from 'src/stores/deck'
import { storeToRefs } from 'pinia'
import { getCardImage } from 'src/js/image_helper'
import DeckImportDialog from 'src/components/deck/DeckImportDialog.vue'
import DeckDialog from 'src/components/deck/DeckDialog.vue'

const $q = useQuasar()
const deckStore = useDeckStore()
const { face, hasDeck, currentDeckName } = storeToRefs(deckStore)

// Right-side (comparison) deck — local state, never touches the store
const compName = ref('Comparison Deck')
const compFace = ref(null)
const compDeck = ref([])
const compSide = ref([])
const hasCompDeck = computed(() => compDeck.value.length > 0 || !!compFace.value)

function openImport() {
  $q.dialog({ component: DeckImportDialog })
    .onOk(({ face, deck, side, name }) => {
      compFace.value = face
      compDeck.value = deck
      compSide.value = side
      compName.value = name || 'Comparison Deck'
    })
}

function clearCompDeck() {
  compFace.value = null
  compDeck.value = []
  compSide.value = []
  compName.value = 'Comparison Deck'
}

const leftDeckList = computed(() => deckStore.getDeckList)
const leftSideList = computed(() => deckStore.getSideList)

const leftTotal = computed(() => {
  const faceQty = face.value ? 1 : 0
  return faceQty + leftDeckList.value.reduce((s, c) => s + c.qty, 0)
})
const rightTotal = computed(() => {
  const faceQty = compFace.value ? 1 : 0
  return faceQty + compDeck.value.reduce((s, c) => s + c.qty, 0)
})

// Group a flat card list + face card by type
const TYPE_ORDER = ['character', 'foundation', 'attack', 'asset', 'action', 'backup']

const byName = (a, b) => a.name.localeCompare(b.name)

function groupByType(cardList, faceCard) {
  const map = {}
  if (faceCard) {
    map['character'] = [{ ...faceCard, qty: 1 }]
  }
  for (const card of cardList) {
    const t = card.type || 'unknown'
    if (!map[t]) map[t] = []
    map[t].push(card)
  }
  for (const t in map) map[t].sort(byName)
  return map
}

const leftByType = computed(() => groupByType(leftDeckList.value, face.value))
const rightByType = computed(() => groupByType(compDeck.value, compFace.value))

// Diff
const diff = computed(() => {
  const leftMap = {}
  if (face.value) leftMap[face.value.asset] = { card: face.value, qty: 1 }
  for (const card of leftDeckList.value) {
    if (leftMap[card.asset]) leftMap[card.asset].qty += card.qty
    else leftMap[card.asset] = { card, qty: card.qty }
  }

  const rightMap = {}
  if (compFace.value) rightMap[compFace.value.asset] = { card: compFace.value, qty: 1 }
  for (const card of compDeck.value) {
    if (rightMap[card.asset]) rightMap[card.asset].qty += card.qty
    else rightMap[card.asset] = { card, qty: card.qty }
  }

  const allAssets = new Set([...Object.keys(leftMap), ...Object.keys(rightMap)])
  const results = []
  for (const asset of allAssets) {
    const left = leftMap[asset]
    const right = rightMap[asset]
    const leftQty = left?.qty || 0
    const rightQty = right?.qty || 0
    const delta = rightQty - leftQty
    if (delta !== 0) {
      results.push({ card: left?.card || right?.card, leftQty, rightQty, delta })
    }
  }
  results.sort((a, b) => a.delta - b.delta)
  return results
})

const diffByTypeMap = computed(() => {
  const map = {}
  for (const entry of diff.value) {
    const t = entry.card.type || 'unknown'
    if (!map[t]) map[t] = []
    map[t].push(entry)
  }
  for (const t in map) map[t].sort((a, b) => byName(a.card, b.card))
  return map
})

// Union of all types present in any column, in consistent order
const allTypes = computed(() => {
  const types = new Set([
    ...Object.keys(leftByType.value),
    ...Object.keys(rightByType.value),
    ...Object.keys(diffByTypeMap.value),
  ])
  const ordered = TYPE_ORDER.filter(t => types.has(t))
  const rest = [...types].filter(t => !TYPE_ORDER.includes(t)).sort()
  return [...ordered, ...rest]
})

const hasSideboard = computed(() =>
  leftSideList.value.length > 0 || compSide.value.length > 0
)

// Push actions
function pushLeft(card) {
  deckStore.increment(card)
}

function pushRight(card) {
  const existing = compDeck.value.find(c => c.asset === card.asset)
  const max = card.limit || 4
  if (existing) {
    if (existing.qty < max) existing.qty++
  } else {
    compDeck.value.push({ ...card, qty: 1 })
  }
}

function decrementRight(card) {
  const idx = compDeck.value.findIndex(c => c.asset === card.asset)
  if (idx === -1) return
  const entry = compDeck.value[idx]
  if (entry.qty > 1) entry.qty--
  else compDeck.value.splice(idx, 1)
}
</script>

<template>
  <q-page class="q-pa-sm">

    <!-- Column headers -->
    <div class="row compare-col-headers">
      <div class="col compare-col-header">
        {{ currentDeckName || 'Current Deck' }}
        <span v-if="hasDeck" class="text-caption text-grey q-ml-xs">({{ leftTotal }})</span>
        <span v-if="!hasDeck" class="text-caption text-grey q-ml-xs">— no deck loaded</span>
        <DeckDialog v-if="!hasDeck" class="q-ml-sm" />
      </div>
      <div class="col compare-col-header">Diff</div>
      <div class="col compare-col-header row items-center">
        <span class="col-grow">{{ compName }}</span>
        <span v-if="hasCompDeck" class="text-caption text-grey q-ml-xs">({{ rightTotal }})</span>
        <q-btn v-if="hasCompDeck" flat dense round icon="upload" size="sm" @click="openImport">
          <q-tooltip>Replace comparison deck</q-tooltip>
        </q-btn>
        <q-btn v-if="hasCompDeck" flat dense round icon="close" size="sm" @click="clearCompDeck">
          <q-tooltip>Clear comparison deck</q-tooltip>
        </q-btn>
        <q-btn v-if="!hasCompDeck" push icon="upload" label="Import deck" color="primary" size="sm" @click="openImport" />
      </div>
    </div>

    <!-- Identical / empty state -->
    <div v-if="hasDeck && hasCompDeck && diff.length === 0" class="row">
      <div class="col-4 offset-4 text-center q-pa-lg">
        <q-icon name="check_circle" color="positive" size="2rem" />
        <div class="text-grey q-mt-sm">Decks are identical</div>
      </div>
    </div>

    <!-- Type bands -->
    <div v-for="type in allTypes" :key="type" class="compare-band">
      <div class="compare-band__header text-caption text-uppercase text-weight-medium">{{ type }}</div>
      <div class="row">

        <!-- Left column -->
        <div class="col compare-cell">
          <q-list>
            <q-item v-for="card in (leftByType[type] || [])" :key="card.asset"
              dense no-wrap :class="`card-list-${card.type}`">
              <q-item-section avatar>
                <q-avatar square class="card-thumb">
                  <img :src="getCardImage(card.asset)" class="card-thumb__img" />
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label lines="2">{{ card.qty }} {{ card.name }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <!-- Diff column -->
        <div class="col compare-cell">
          <q-list>
            <q-item v-for="entry in (diffByTypeMap[type] || [])" :key="entry.card.asset"
              dense no-wrap :class="entry.delta < 0 ? 'diff-removed' : 'diff-added'">
              <q-item-section avatar>
                <q-avatar square class="card-thumb">
                  <img :src="getCardImage(entry.card.asset)" class="card-thumb__img" />
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  <span class="diff-sign" :class="entry.delta < 0 ? 'diff-sign--removed' : 'diff-sign--added'">
                    {{ entry.delta > 0 ? '+' : '' }}{{ entry.delta }}
                  </span>
                  {{ entry.card.name }}
                </q-item-label>
                <q-item-label caption class="diff-qty">{{ entry.leftQty }} → {{ entry.rightQty }}</q-item-label>
              </q-item-section>
              <q-item-section side class="push-btns">
                <template v-if="entry.delta < 0">
                  <q-btn flat dense round icon="remove" size="sm" @click="deckStore.decrement(entry.card)">
                    <q-tooltip>Remove one from my deck</q-tooltip>
                  </q-btn>
                  <q-btn flat dense round icon="add" size="sm" @click="pushRight(entry.card)">
                    <q-tooltip>Add one to comparison deck</q-tooltip>
                  </q-btn>
                </template>
                <template v-else>
                  <q-btn flat dense round icon="add" size="sm" @click="pushLeft(entry.card)">
                    <q-tooltip>Add one to my deck</q-tooltip>
                  </q-btn>
                  <q-btn flat dense round icon="remove" size="sm" @click="decrementRight(entry.card)">
                    <q-tooltip>Remove one from comparison deck</q-tooltip>
                  </q-btn>
                </template>
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <!-- Right column -->
        <div class="col compare-cell">
          <q-list>
            <q-item v-for="card in (rightByType[type] || [])" :key="card.asset"
              dense no-wrap :class="`card-list-${card.type}`">
              <q-item-section avatar>
                <q-avatar square class="card-thumb">
                  <img :src="getCardImage(card.asset)" class="card-thumb__img" />
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label lines="2">{{ card.qty }} {{ card.name }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>

      </div>
    </div>

    <!-- Sideboard band -->
    <div v-if="hasSideboard" class="compare-band">
      <div class="compare-band__header text-caption text-uppercase text-weight-medium">sideboard</div>
      <div class="row">
        <div class="col compare-cell">
          <q-list>
            <q-item v-for="card in leftSideList" :key="card.asset" dense no-wrap class="card-list-side">
              <q-item-section avatar>
                <q-avatar square class="card-thumb">
                  <img :src="getCardImage(card.asset)" class="card-thumb__img" />
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label lines="2">{{ card.qty }} {{ card.name }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
        <div class="col compare-cell"></div>
        <div class="col compare-cell">
          <q-list>
            <q-item v-for="card in compSide" :key="card.asset" dense no-wrap class="card-list-side">
              <q-item-section avatar>
                <q-avatar square class="card-thumb">
                  <img :src="getCardImage(card.asset)" class="card-thumb__img" />
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label lines="2">{{ card.qty }} {{ card.name }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </div>
    </div>

  </q-page>
</template>

<style scoped>
.compare-col-headers {
  border-bottom: 2px solid rgba(0, 0, 0, 0.18);
  margin-bottom: 4px;
}
.compare-col-header {
  padding: 8px 4px;
  font-size: 1rem;
  font-weight: 500;
}
.compare-band {
  margin-bottom: 2px;
}
.compare-band__header {
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 8px;
  letter-spacing: 0.05em;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}
.compare-cell {
  min-width: 0;
}
.diff-added {
  background-color: rgba(0, 200, 83, 0.15);
  border-left: 3px solid #00c853;
}
.diff-removed {
  background-color: rgba(213, 0, 0, 0.15);
  border-left: 3px solid #d50000;
}
.diff-sign {
  font-weight: bold;
  font-family: monospace;
  margin-right: 4px;
}
.diff-sign--added { color: #00c853; }
.diff-sign--removed { color: #d50000; }
.diff-qty {
  font-family: monospace;
  opacity: 0.7;
}
.push-btns {
  flex-direction: row;
  padding: 0;
}
</style>
