<script setup>
  import { ref } from 'vue'
  import DeckLoader from 'components/deck/DeckLoader.vue'
  import DeckView from 'components/deck/DeckView.vue'
  const leftDrawerOpen = ref(false)
  const deckViewOpen = ref(false)
  const deckLoadOpen = ref(false)

  function toggleLeftDrawer () {
    leftDrawerOpen.value = !leftDrawerOpen.value
  }
  function toggleDeckView () {
    deckViewOpen.value = !deckViewOpen.value
    deckLoadOpen.value = false
  }
  function toggleDeckLoad () {
    deckLoadOpen.value = !deckLoadOpen.value
    deckViewOpen.value = false
  }
</script>

<template>
  <q-layout view="hhr lpR fFf">

    <q-header reveal elevated class="bg-primary text-white" height-hint="98">
      <q-toolbar>
        <q-btn dense flat round icon="menu" @click="toggleLeftDrawer" />

        <q-toolbar-title>
          <q-avatar>
            <img src="https://cdn.quasar.dev/logo-v2/svg/logo-mono-white.svg">
          </q-avatar>
          BuildUVS
        </q-toolbar-title>

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
    </q-drawer>

    <q-drawer v-model="deckViewOpen" side="right" elevated>
      <DeckView />
    </q-drawer>
    
    <q-drawer v-model="deckLoadOpen" side="right" elevated>
      <DeckLoader />
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

  </q-layout>
</template>