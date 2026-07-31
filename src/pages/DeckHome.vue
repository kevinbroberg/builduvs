<script setup>
import DeckBody from 'components/deck/DeckBody.vue'
import DeckStage from 'components/deck/DeckStage.vue'
import DeckDialog from 'components/deck/DeckDialog.vue'
import QuickAddSelect from 'components/deck/QuickAddSelect.vue'
import CardeioExportDialog from 'components/deck/CardeioExportDialog.vue'
import { useQuasar } from 'quasar'
import { useDeckStore } from 'src/stores/deck'
import { storeToRefs } from 'pinia'
import { ref, watchEffect } from 'vue'
import { downloadTTSJson } from 'src/js/tts_export'
import { setPageTitle } from 'src/js/page_title'

import {
  face,
  clearFace,
  deck2clipboard,
  partitions,
  trash,
  partitionOptions,
  howPartition,
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

const $q = useQuasar()
const deckStore = useDeckStore()
const { hasDeck } = storeToRefs(deckStore)

// Keep the browser tab / history entry named after the current deck.
watchEffect(() => {
  setPageTitle(hasDeck.value ? deckStore.currentDeckName : 'Your Deck')
})

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
    <div class="row items-center q-gutter-sm q-ma-sm">
      <q-btn-group push>
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

      <!-- Quick add by name -->
      <QuickAddSelect />

      <!-- Tiles / list toggle -->
      <q-btn-toggle
        :model-value="view"
        @update:model-value="setView"
        push
        no-caps
        toggle-color="orange"
        :options="[
          { value: 'tiles', icon: 'grid_view', slot: 'tiles' },
          { value: 'list', icon: 'view_list', slot: 'list' },
        ]"
      >
        <template v-slot:tiles><q-tooltip>Card tiles</q-tooltip></template>
        <template v-slot:list><q-tooltip>Text list</q-tooltip></template>
      </q-btn-toggle>

      <!-- Image size (tiles view only) -->
      <div v-if="view === 'tiles'" class="col-control">
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
    </div>

    <!-- Stage -->
    <DeckStage
      :face-asset="face?.asset ?? null"
      :face-name="face?.name ?? ''"
      :list-view="view === 'list'"
      clearable
      @clear-face="clearFace"
    >
      <template #face-empty>
        <q-icon name="account_circle" size="64px" />
        <div class="face-empty__label">No face character set</div>
        <QuickAddSelect
          charactersOnly
          label="Add a character"
          class="face-empty__search"
        />
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
        :partitions="partitions"
        :view="view"
        :columns="columns"
        :editable="true"
      />
    </DeckStage>
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

.face-empty__label {
  color: rgba(255, 255, 255, 0.5);
}
.face-empty__search {
  margin-top: 8px;
  width: 240px;
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
