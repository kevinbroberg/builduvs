<script setup>
import { ref } from "vue";
import { useDeckStore } from "src/stores/deck";
import { storeToRefs } from "pinia";
import DeckView from "src/components/deck/DeckView.vue";
import DeckLibrary from "src/components/deck/DeckLibrary.vue";

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
        <q-btn dense flat round icon="menu" @click="toggleLeftDrawer" />

        <q-toolbar-title shrink>
          <q-avatar>
            <!-- TODO make a SVG -->
            <img
              src="icons\icon-128x128.png"
              width="128"
              height="128"
              alt="logo"
            />
          </q-avatar>
          <span class="gt-xs">BuildUVS</span>
        </q-toolbar-title>
        <q-tabs align="center">
          <q-route-tab to="/" label="Game Tracker" icon="sports_esports" />
          <q-route-tab to="/deck" label="Deck Detail" icon="style" />
          <q-route-tab to="/cards" label="Search" icon="search" />
          <q-route-tab to="/settings" label="Settings" icon="settings" />
          <q-route-tab to="/shuffle" label="Shuffle" icon="shuffle" />
          <q-route-tab to="/rewards" label="Rewards" icon="redeem" />
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

    <q-drawer v-model="leftDrawerOpen" side="left" behavior="mobile" elevated>
      <DeckLibrary />
    </q-drawer>

    <q-drawer v-model="rightDrawerOpen" side="right" elevated>
      <DeckView />
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<style>
@media (max-width: 600px) {
  .q-tab__label { display: none; }
}
</style>
