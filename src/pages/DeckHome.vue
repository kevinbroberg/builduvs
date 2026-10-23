<script setup>
import DeckBody from 'components/deck/DeckBody.vue'
import DeckStage from 'components/deck/DeckStage.vue'
import DeckDialog from 'components/deck/DeckDialog.vue'
import QuickAddSelect from 'components/deck/QuickAddSelect.vue'
import DeckSummary from 'components/deck/DeckSummary.vue'
import HydraExportDialog from 'components/deck/HydraExportDialog.vue'
import Filters from 'components/filter/Filters.vue'
import InfiniteScrollCardDetailList from 'components/cards/InfiniteScrollCardDetailList.vue'
import { useQuasar } from 'quasar'
import { useDeckStore } from 'src/stores/deck'
import { storeToRefs } from 'pinia'
import { ref, computed, watchEffect } from 'vue'
import { downloadTTSJson } from 'src/js/tts_export'
import { tierLink } from 'src/js/tier_file'
import { useCardDrag } from 'src/js/card_drag'
import { getCardImage } from 'src/js/image_helper'
import { setPageTitle } from 'src/js/page_title'

import {
  face,
  clearFace,
  deck2clipboard,
  partitions,
  trash,
  partitionOptions,
  howPartition,
  sorts,
  sortField,
  compare,
} from 'components/deck/deck_logic'

const columns = ref(Number(localStorage.getItem('deckColumns')) || 8)
function setColumns(n) {
  columns.value = n
  localStorage.setItem('deckColumns', String(n))
}

const view = ref(localStorage.getItem('deckView') || 'tiles')
function setView(v) {
  view.value = v
  localStorage.setItem('deckView', v)
}

// Add Cards: the full card search in a maximized dialog, so you can build
// without leaving the deck.
const addCardsOpen = ref(false)

const deckSize = computed(() =>
  deckStore.getDeckList.reduce((n, c) => n + c.qty, 0) + (face.value ? 1 : 0)
)

const sortLabel = computed(() =>
  sorts.find(s => s.field === sortField.value)?.label ?? 'deck order'
)

// Group By is global (deck_logic.partitions); the sort applies within each pile here.
const displayPartitions = computed(() => sortField.value
  ? partitions.value.map(part => ({ ...part, cards: [...part.cards].sort(compare) }))
  : partitions.value)

const $q = useQuasar()
const deckStore = useDeckStore()
const { hasDeck, hasMaybe } = storeToRefs(deckStore)

// Keep the browser tab / history entry named after the current deck.
watchEffect(() => {
  setPageTitle(hasDeck.value ? deckStore.currentDeckName : 'Your Deck')
})

/* ----- Drag and drop: between main / side / maybe, character → face slot ----- */

const BOARD_STATE = { main: 'deck', side: 'side', maybe: 'maybe' }

// Work from the store's own entry: the dragged card may be a filtered/sorted copy.
function storeEntry(inst) {
  return deckStore[BOARD_STATE[inst.zone]]?.[inst.card.asset]
}

const isCharacter = inst => storeEntry(inst)?.type === 'character'

function onDrop(inst, zone) {
  const entry = storeEntry(inst)
  if (!entry) return
  if (zone in BOARD_STATE) deckStore.moveCard(entry, inst.zone, zone)
  else if (zone === 'face' && entry.type === 'character') {
    // One copy becomes the face; the old face goes back into the main deck.
    const { qty, ...card } = entry
    const oldFace = deckStore.face
    if (inst.zone === 'side') deckStore.decrementSide(entry)
    else if (inst.zone === 'maybe') deckStore.decrementMaybe(entry)
    else deckStore.decrement(entry)
    deckStore.setFace(card)
    if (oldFace) deckStore.increment(oldFace)
  }
}

const drag = useCardDrag({ onDrop })

const ZONE_LABELS = { main: 'Mainboard', side: 'Sideboard', maybe: 'Maybeboard', face: 'Character' }

// Right-column targets for the off-deck boards, offered while a card from any
// other board is in flight. The column is sticky, so they stay in reach however
// far down the deck you are.
const SIDE_BOXES = [
  { zone: 'side', icon: 'inventory_2', hint: '10 cards to swap between games' },
  { zone: 'maybe', icon: 'help_outline', hint: "Extra space when you're not sure" },
]
const sideBoxes = computed(() => (drag.dragging.value && drag.dragInst.value)
  ? SIDE_BOXES.filter(b => b.zone !== drag.dragInst.value.zone)
  : [])

// Where the card would go if dropped now; null when the drop would do nothing.
const dropTarget = computed(() => {
  const inst = drag.dragInst.value
  const zone = drag.hoverZone.value
  if (!inst || !zone || zone === inst.zone) return null
  if (zone === 'face' && !isCharacter(inst)) return null
  return zone
})

async function openImport() {
  const { default: DeckLoaderDialog } = await import('components/deck/DeckLoaderDialog.vue')
  $q.dialog({ component: DeckLoaderDialog })
}

function openHydraExport() {
  $q.dialog({ component: HydraExportDialog })
}

function downloadTTS() {
  const name = deckStore.currentDeckName || 'UVS Deck'
  downloadTTSJson(name, deckStore.face, deckStore.getDeckList, deckStore.getSideList)
}

const rankLink = computed(() => tierLink(deckStore.currentDeckName,
  [deckStore.face, ...deckStore.getDeckList, ...deckStore.getSideList]))
</script>

<template>
  <!-- Empty state -->
  <!-- A maybeboard alone still counts: emptying the main deck mustn't hide it. -->
  <div v-if="!hasDeck && !hasMaybe" class="empty-state">
    <p class="empty-state__text">Import a deck?</p>
    <DeckDialog />
    <p class="empty-state__text">or start from scratch</p>
    <q-btn push icon="search" label="Add Cards" @click="addCardsOpen = true" />
    <p class="empty-state__text">
      or browse
      <router-link to="/lists" class="locals-link">Local Championship decklists</router-link>
    </p>
  </div>

  <template v-else>
    <!-- Toolbar rail: build on the left, arrange the view on the right -->
    <div class="deck-rail row items-center">
      <q-btn unelevated no-caps color="primary" icon="upload_file" label="Import" @click="openImport">
        <q-tooltip>Load a deck from file or text</q-tooltip>
      </q-btn>

      <q-separator vertical inset dark />

      <q-btn unelevated no-caps color="secondary" icon="search" label="Add Cards" @click="addCardsOpen = true">
        <q-tooltip>Search the full card pool and add to this deck</q-tooltip>
      </q-btn>
      <QuickAddSelect class="rail-field" />

      <q-space />

      <!-- View As (+ image size for tiles) -->
      <q-btn-dropdown flat no-caps :icon="view === 'tiles' ? 'grid_view' : 'view_list'"
        :label="'View: ' + (view === 'tiles' ? 'Tiles' : 'Text list')">
        <q-list style="min-width: 220px">
          <q-item clickable v-close-popup :active="view === 'tiles'" active-class="bg-orange-13"
            @click="setView('tiles')">
            <q-item-section avatar><q-icon name="grid_view" /></q-item-section>
            <q-item-section>Tiles</q-item-section>
          </q-item>
          <q-item clickable v-close-popup :active="view === 'list'" active-class="bg-orange-13"
            @click="setView('list')">
            <q-item-section avatar><q-icon name="view_list" /></q-item-section>
            <q-item-section>Text list</q-item-section>
          </q-item>
          <template v-if="view === 'tiles'">
            <q-separator />
            <q-item>
              <q-item-section>
                <q-item-label caption>Image size</q-item-label>
                <div class="row items-center no-wrap q-gutter-x-sm">
                  <q-icon name="photo_size_select_small" size="18px" />
                  <q-slider
                    :model-value="columns"
                    @update:model-value="setColumns"
                    :min="4"
                    :max="14"
                    :step="1"
                    markers
                    snap
                    label
                    :label-value="columns + ' cols'"
                    color="orange"
                  />
                  <q-icon name="photo_size_select_large" size="22px" />
                </div>
              </q-item-section>
            </q-item>
          </template>
        </q-list>
      </q-btn-dropdown>

      <!-- Group By -->
      <q-btn-dropdown flat no-caps icon="dashboard" :label="'Group: ' + howPartition">
        <q-list>
          <q-item v-for="opt in partitionOptions" :key="opt" clickable v-close-popup
            :active="howPartition === opt" active-class="bg-orange-13" @click="howPartition = opt">
            <q-item-section>{{ opt }}</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <!-- Sort By -->
      <q-btn-dropdown flat no-caps icon="sort" :label="'Sort: ' + sortLabel">
        <q-list>
          <q-item clickable v-close-popup :active="!sortField" active-class="bg-orange-13"
            @click="sortField = ''">
            <q-item-section>deck order</q-item-section>
          </q-item>
          <q-item v-for="opt in sorts" :key="opt.field" clickable v-close-popup
            :active="sortField === opt.field" active-class="bg-orange-13" @click="sortField = opt.field">
            <q-item-section class="text-capitalize">{{ opt.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <q-separator vertical inset dark />

      <q-btn flat round icon="cloud_upload" @click="openHydraExport">
        <q-tooltip>Publish to play.uvsgames.com</q-tooltip>
      </q-btn>
      <q-btn flat round icon="leaderboard" :to="rankLink">
        <q-tooltip>Open this deck's cards in the Tier Maker</q-tooltip>
      </q-btn>
      <q-btn flat round icon="download" @click="downloadTTS">
        <q-tooltip>Download Tabletop Simulator deck</q-tooltip>
      </q-btn>
      <q-btn flat round icon="content_copy" @click="deck2clipboard">
        <q-tooltip>Copy decklist to clipboard</q-tooltip>
      </q-btn>
      <q-btn flat round icon="delete" color="negative" @click="trash">
        <q-tooltip>Wipe deck</q-tooltip>
      </q-btn>
    </div>

    <!-- Stage -->
    <DeckStage
      :face-asset="face?.asset ?? null"
      :face-name="face?.name ?? ''"
      :list-view="view === 'list'"
      clearable
      face-drop-zone="face"
      :face-drop-active="dropTarget === 'face'"
      @clear-face="clearFace"
    >
      <template #face-empty>
        <q-icon name="account_circle" size="64px" />
        <div class="face-empty__label">No character set</div>
        <QuickAddSelect
          charactersOnly
          label="Add a character"
          class="face-empty__search"
        />
      </template>

      <template #face-footer>
        <div
          v-for="box in sideBoxes"
          :key="box.zone"
          class="side-dropbox"
          :class="{ 'side-dropbox--hover': dropTarget === box.zone }"
          :data-drop-zone="box.zone"
        >
          <q-icon :name="box.icon" size="32px" />
          <div class="side-dropbox__title">{{ ZONE_LABELS[box.zone] }}</div>
          <div class="side-dropbox__hint">{{ box.hint }}</div>
        </div>
        <!-- Main deck only: the sideboard and maybeboard don't define the deck. -->
        <DeckSummary :face="face" :cards="deckStore.getDeckList" />

      </template>

      <div class="deck-name">
        {{ deckStore.currentDeckName }}
        <q-icon name="edit" class="deck-name__edit" size="18px" />
        <q-popup-edit
          v-model="deckStore.currentDeckName"
          auto-save
          v-slot="scope"
          :cover="false"
          anchor="bottom left"
        >
          <q-input
            v-model="scope.value"
            dense
            autofocus
            counter
            label="Deck name"
            @keyup.enter="scope.set"
          >
            <template v-slot:append>
              <q-icon name="check" class="cursor-pointer" @click="scope.set" />
            </template>
          </q-input>
        </q-popup-edit>
      </div>

      <DeckBody
        :partitions="displayPartitions"
        :view="view"
        :columns="columns"
        :editable="true"
        :drag="drag"
      />
    </DeckStage>

    <!-- Drag ghost: follows the pointer; pointer-events:none so hit-testing sees the zone -->
    <div v-if="drag.dragging.value && drag.dragInst.value" class="drag-ghost" :style="drag.ghostStyle.value">
      <img :src="getCardImage(drag.dragInst.value.card.asset)" :alt="drag.dragInst.value.card.name" />
      <div v-if="dropTarget" class="drag-ghost__zone">{{ ZONE_LABELS[dropTarget] }}</div>
    </div>
  </template>

  <!-- Add Cards: the real search stack, maximized over the deck -->
  <q-dialog v-model="addCardsOpen" maximized transition-show="slide-up" transition-hide="slide-down">
    <q-card>
      <q-toolbar class="bg-secondary text-white">
        <q-icon name="search" size="sm" class="q-mr-sm" />
        <q-toolbar-title>Add Cards</q-toolbar-title>
        <div class="text-caption q-mr-md">Deck size: {{ deckSize }}</div>
        <q-btn flat round dense icon="close" v-close-popup />
      </q-toolbar>
      <q-card-section class="scroll" style="max-height: calc(100vh - 50px)">
        <Filters />
        <InfiniteScrollCardDetailList />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 1rem;
  text-align: center;
}
.empty-state__text {
  font-size: 1.2rem;
  font-weight: 500;
  margin: 0;
}
.locals-link {
  font-size: 1rem;
  text-decoration: underline;
}

.face-empty__label {
  color: rgba(255, 255, 255, 0.5);
}
.face-empty__search {
  margin-top: 8px;
  width: 240px;
}

/* Toolbar rail: same palette as the DeckStage below it, so the two read as one unit */
.deck-rail {
  margin: 8px 8px 0;
  gap: 8px;
  padding: 10px;
  border-radius: 14px 14px 0 0;
  background: linear-gradient(#2c2f36, #1f2128);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: #f1f1f4;
}
.deck-rail :deep(.q-btn--flat) {
  color: #f1f1f4;
}
.rail-field :deep(.q-field__control) {
  background: #fafafa;
  border-radius: 6px;
}
/* Butt the stage up against the rail */
.deck-rail + .deck-stage {
  margin-top: 0;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.side-dropbox {
  width: 100%;
  max-width: 300px;
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border: 2px dashed rgba(255, 171, 64, 0.55);
  border-radius: 12px;
  color: #ffcc80;
  background: rgba(255, 171, 64, 0.06);
  transition: background-color 0.12s ease, border-color 0.12s ease;
}
.side-dropbox--hover {
  border-color: #ffab40;
  background: rgba(255, 171, 64, 0.2);
  color: #fff;
}
.side-dropbox__title {
  font-size: 1.1rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.side-dropbox__hint {
  font-size: 0.8rem;
  opacity: 0.8;
}

.drag-ghost {
  position: fixed;
  width: 110px;
  margin: -76px 0 0 -55px; /* centre under the pointer */
  pointer-events: none;
  z-index: 9000;
  transform: rotate(-5deg) scale(1.06);
  filter: drop-shadow(0 14px 18px rgba(0, 0, 0, 0.55));
}
.drag-ghost img {
  display: block;
  width: 100%;
  border-radius: 8px;
}
.drag-ghost__zone {
  position: absolute;
  bottom: 100%;
  left: -10px;
  right: -10px;
  margin-bottom: 6px;
  text-align: center;
  font-weight: 700;
  color: #fff;
  background: #ef6c00;
  border-radius: 6px;
  padding: 2px 6px;
}

/* Deck name lives in the DeckStage body slot (dark background) */
.deck-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #fff;
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
  cursor: pointer;
  border-radius: 6px;
  padding: 2px 8px;
  transition: background 0.12s ease;
}
.deck-name:hover {
  background: rgba(255, 255, 255, 0.1);
}
.deck-name__edit {
  opacity: 0;
  transition: opacity 0.12s ease;
}
.deck-name:hover .deck-name__edit {
  opacity: 0.8;
}
</style>
