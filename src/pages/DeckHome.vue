<script setup>
import DeckCardTile from 'src/components/cards/DeckCardTile.vue'
import DeckDialog from 'components/deck/DeckDialog.vue'
import CardeioExportDialog from 'components/deck/CardeioExportDialog.vue'
import { getCardImage } from 'src/js/image_helper'
import { useQuasar } from 'quasar'
import { useDeckStore } from 'src/stores/deck'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { downloadTTSJson } from 'src/js/tts_export'

const columns = ref(Number(localStorage.getItem('deckColumns')) || 8)
const gridStyle = computed(() => ({ gridTemplateColumns: `repeat(${columns.value}, 1fr)` }))
function setColumns(n) {
  columns.value = n
  localStorage.setItem('deckColumns', String(n))
}

import {
  face,
  deck2clipboard,
  partitions,
  trash,
  SIDEKEY,
  partitionOptions,
  howPartition,
} from 'components/deck/deck_logic'

const $q = useQuasar()
const deckStore = useDeckStore()
const { hasDeck } = storeToRefs(deckStore)

const mainPartitions = computed(() => partitions.value.filter((p) => p.key !== SIDEKEY))
const sidePartition = computed(() => partitions.value.find((p) => p.key === SIDEKEY))

function openCardeioExport() {
  $q.dialog({ component: CardeioExportDialog })
}

function downloadTTS() {
  const name = deckStore.currentDeckName || 'UVS Deck'
  downloadTTSJson(name, deckStore.face, deckStore.getDeckList, deckStore.getSideList)
}
</script>

<template>
  <!-- Empty state -->
  <div v-if="!hasDeck" class="empty-state">
    <p class="empty-state__text">Import a deck?</p>
    <DeckDialog />
    <p class="empty-state__text">
      or browse
      <router-link to="/lists" class="locals-link">Local Championship decklists</router-link>
    </p>
  </div>

  <template v-else>
    <!-- Toolbar -->
    <q-btn-group push class="q-ma-sm">
      <DeckDialog />

      <q-btn-dropdown
        menu-self="bottom middle"
        push
        stack
        auto-close
        label="Views"
        icon="grid_view"
      >
        <q-item
          v-for="partOpt in partitionOptions"
          :key="partOpt"
          clickable
          @click="howPartition = partOpt"
          :active="howPartition === partOpt"
          active-class="bg-orange-13"
        >
          <q-item-label>{{ partOpt }}</q-item-label>
        </q-item>
      </q-btn-dropdown>
      <q-btn push label="Export" icon="cloud_upload" @click="openCardeioExport">
        <q-tooltip>Push this deck to carde.io</q-tooltip>
      </q-btn>
      <q-btn push label="Copy" icon="content_copy" @click="deck2clipboard">
        <q-tooltip>Copies your deck to clipboard</q-tooltip>
      </q-btn>
      <q-btn push label="TTS" icon="download" @click="downloadTTS">
        <q-tooltip>Download Tabletop Simulator deck</q-tooltip>
      </q-btn>
      <q-btn outline label="Wipe" icon="delete" color="negative" @click="trash" />
    </q-btn-group>

    <div class="col-control q-ma-sm">
      <span class="col-control__label">Image size</span>
      <q-icon name="photo_size_select_small" size="20px" />
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
        style="width: 160px"
        color="orange"
      />
      <q-icon name="photo_size_select_large" size="24px" />
    </div>

    <!-- Stage -->
    <div class="deck-stage">
      <!-- Left / center: main deck + sideboard -->
      <div class="deck-stage__body">
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

        <div v-for="partition in mainPartitions" :key="partition.key" class="deck-section">
          <div class="deck-section__label">{{ partition.label }}</div>
          <div class="deck-grid" :style="gridStyle">
            <DeckCardTile
              v-for="card in partition.cards"
              :key="card.asset"
              :card="card"
              :main="true"
            />
          </div>
        </div>

        <!-- Sideboard -->
        <div v-if="sidePartition" class="deck-section deck-section--side">
          <div class="deck-section__label">SIDE BOARD &middot; {{ sidePartition.label }}</div>
          <div class="deck-grid deck-grid--side" :style="gridStyle">
            <DeckCardTile
              v-for="card in sidePartition.cards"
              :key="card.asset"
              :card="card"
              :main="false"
            />
          </div>
        </div>
      </div>

      <!-- Right: large face preview -->
      <div class="deck-stage__face">
        <template v-if="face">
          <q-img
            class="face-card"
            fit="contain"
            :ratio="59 / 86"
            :src="getCardImage(face.asset)"
            :alt="face.name"
          />
          <div class="face-name">{{ face.name }}</div>
        </template>
        <div v-else class="face-empty">
          <q-icon name="account_circle" size="64px" />
          <div>No face character set</div>
        </div>
      </div>
    </div>
  </template>
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

.col-control {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  vertical-align: middle;
  color: #555;
}
.col-control__label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ---- Stage ---- */
.deck-stage {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: stretch;
  margin: 8px;
  padding: 20px;
  border-radius: 14px;
  background:
    radial-gradient(circle at 20% 0%, rgba(90, 60, 140, 0.35), transparent 60%),
    linear-gradient(135deg, #2a2f2a 0%, #1c1e24 55%, #14151a 100%);
  box-shadow: inset 0 0 120px rgba(0, 0, 0, 0.5);
}

.deck-stage__body {
  flex: 1 1 640px;
  min-width: 0;
}

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

.deck-section {
  margin-bottom: 20px;
}
.deck-section__label {
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.deck-section--side .deck-section__label {
  color: #ffcf6b;
}

/* Orderly rows of cards — column count is driven by the slider (inline style) */
.deck-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 14px;
}

/* ---- Face preview ---- */
.deck-stage__face {
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.face-card {
  width: 100%;
  max-width: 300px;
  border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.7);
}
.face-name {
  color: #fff;
  font-size: 1.5rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
  text-align: center;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}
.face-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.5);
  padding-top: 40px;
}

@media (max-width: 700px) {
  .deck-stage__face {
    flex-basis: 100%;
    order: -1;
  }
}
</style>
