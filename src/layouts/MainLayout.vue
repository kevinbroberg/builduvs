<script setup>
  import { ref } from 'vue'
  import DeckLoader from 'components/deck/DeckLoader.vue'
  import DeckView from 'components/deck/DeckView.vue'
  const leftDrawerOpen = ref(false)
  const deckViewOpen = ref(false)
  const deckLoadOpen = ref(false)
  const rightDrawerOpen = ref(false)
  // const rightDrawerOpen = computed(deckViewOpen.value || deckLoadOpen.value) // but this crashed the app
  
  function toggleLeftDrawer () {
    leftDrawerOpen.value = !leftDrawerOpen.value
  }
  function toggleDeckView () {
    deckViewOpen.value = !deckViewOpen.value
    deckLoadOpen.value = false
    if (rightDrawerOpen.value != deckViewOpen.value) {
      rightDrawerOpen.value = deckViewOpen.value
    }
  }
  function toggleDeckLoad () {
    deckLoadOpen.value = !deckLoadOpen.value
    deckViewOpen.value = false
    
    if (rightDrawerOpen.value != deckLoadOpen.value) {
      rightDrawerOpen.value = deckLoadOpen.value
    }
  }

  import { useStore } from 'vuex';
  const store = useStore()
  function deck2clipboard() {
    navigator.clipboard.writeText(store.getters['deck/getDeckText'])
  }
</script>

<template>
  <q-layout view="hhr lpR fFf">

    <q-header reveal elevated class="bg-primary text-white" height-hint="98">
      <q-toolbar>
        <q-btn dense flat round icon="menu" @click="toggleLeftDrawer" />

        <q-toolbar-title>
          <q-avatar>
            <!-- TODO make a SVG -->
            <img src="icons\icon-128x128.png">
          </q-avatar>
          BuildUVS
        </q-toolbar-title>

        <q-btn dense flat round icon="content_copy" @click="deck2clipboard">
          <q-tooltip>Copy your deck to the clipboard as text</q-tooltip>
        </q-btn>
        <q-btn dense flat round icon="file_upload" @click="toggleDeckLoad">
          <q-tooltip>Load a deck from file or with text input</q-tooltip>
        </q-btn>
        <q-btn dense flat round icon="description" @click="toggleDeckView" >
          <q-tooltip>View current deck</q-tooltip>
        </q-btn>
      </q-toolbar>

      <!-- <q-tabs align="left"> -->
        <!-- <q-route-tab to="/" label="Search" /> -->
        <!-- <q-route-tab to="/deck" label="Deck" /> -->
        <!-- <q-route-tab to="/load" label="Deck loader" /> -->
      <!-- </q-tabs> -->
    </q-header>

    <q-drawer v-model="leftDrawerOpen" side="left" behavior="mobile" elevated>
      <h4 style='text-align: center'>Deck listing will go here once implemented</h4>
    </q-drawer>

    <q-drawer v-model="rightDrawerOpen" side="right" elevated>
      <DeckView v-if="deckViewOpen" />
      <DeckLoader v-if="deckLoadOpen" />
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

  </q-layout>
</template>