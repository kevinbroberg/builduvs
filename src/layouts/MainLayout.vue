<script setup>
import { ref } from "vue";
import { useDeckStore } from "src/stores/deck";
import { storeToRefs } from "pinia";
import DeckView from "src/components/deck/DeckView.vue";

const { hasDeck } = storeToRefs(useDeckStore());
const leftDrawerOpen = ref(false);
const rightDrawerOpen = ref(false);

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}
function toggleRightDrawer() {
  rightDrawerOpen.value = !rightDrawerOpen.value;
}
</script>

<template>
  <q-layout view="hhr lpR fFf">
    <q-header reveal elevated class="bg-primary text-white">
      <q-toolbar>
        <!-- <q-btn dense flat round icon="menu" @click="toggleLeftDrawer" /> -->

        <q-toolbar-title>
          <q-avatar>
            <!-- TODO make a SVG -->
            <img
              src="icons\icon-128x128.png"
              width="128"
              height="128"
              alt="logo"
            />
          </q-avatar>
          BuildUVS
        </q-toolbar-title>
        <q-tabs align="center">
          <q-route-tab to="/" label="Game Tracker" />
          <q-route-tab to="/deck" label="Deck Detail" />
          <q-route-tab to="/cards" label="Search" />
          <q-route-tab to="/settings" label="Settings" />
        </q-tabs>
        <!-- <NamePicker /> -->
        <q-btn dense flat round
          icon="table_view"
          @click="toggleRightDrawer"
          v-if="hasDeck"
          label="Deck"
          >
          <q-tooltip>View current deck</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-header>

    <!-- <q-drawer v-model="leftDrawerOpen" side="left" behavior="mobile" elevated>
      <h4>Deck listing will go here once implemented</h4>
    </q-drawer> -->

    <q-drawer v-model="rightDrawerOpen" side="right" elevated>
      <DeckView />
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>
