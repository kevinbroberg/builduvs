<script setup>
import { useDeckStore } from 'src/stores/deck'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import DeckNameDialog from './DeckNameDialog.vue'

const deckStore = useDeckStore()
const { savedDecksList, currentDeckId, currentDeckName, currentDeckFormat, hasDeck } = storeToRefs(deckStore)
const $q = useQuasar()

function autoSaveAndSwitch(deckId) {
  if (hasDeck.value && currentDeckId.value) {
    deckStore.saveDeck()
  }
  deckStore.loadDeck(deckId)
}

function newDeck() {
  if (hasDeck.value && currentDeckId.value) {
    deckStore.saveDeck()
  }
  deckStore.newDeck()
}

function saveCurrentDeck() {
  if (!currentDeckId.value) {
    $q.dialog({
      component: DeckNameDialog,
      componentProps: {
        initialName: currentDeckName.value,
        initialFormat: currentDeckFormat.value,
      },
    }).onOk(({ name, format }) => {
      deckStore.saveDeck(name, format)
    })
  } else {
    deckStore.saveDeck()
  }
}

function confirmDelete(deckId, deckName) {
  $q.dialog({
    title: 'Delete Deck',
    message: `Are you sure you want to delete "${deckName}"?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    deckStore.deleteDeck(deckId)
  })
}

function formatDate(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="column full-height">
    <q-toolbar class="bg-primary text-white">
      <q-toolbar-title>Deck Library</q-toolbar-title>
    </q-toolbar>

    <div class="q-pa-sm">
      <q-btn-group push class="full-width">
        <q-btn push icon="add" label="New" @click="newDeck" color="positive" />
        <q-btn push icon="save" label="Save" @click="saveCurrentDeck" color="primary" :disable="!hasDeck" />
      </q-btn-group>
    </div>

    <q-separator />

    <q-scroll-area class="col">
      <q-list separator>
        <q-item
          v-for="deck in savedDecksList"
          :key="deck.id"
          clickable
          @click="autoSaveAndSwitch(deck.id)"
          :active="deck.id === currentDeckId"
          active-class="bg-blue-2"
        >
          <q-item-section>
            <q-item-label>{{ deck.name }}</q-item-label>
            <q-item-label caption v-if="deck.format">{{ deck.format }}</q-item-label>
            <q-item-label caption>{{ formatDate(deck.modified) }}</q-item-label>
          </q-item-section>

          <q-item-section side>
            <q-btn
              flat dense round
              icon="delete"
              color="negative"
              @click.stop="confirmDelete(deck.id, deck.name)"
            />
          </q-item-section>
        </q-item>

        <q-item v-if="savedDecksList.length === 0">
          <q-item-section>
            <q-item-label caption class="text-center">No saved decks yet</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-scroll-area>
  </div>
</template>
