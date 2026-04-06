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
      <q-list>
        <q-item clickable v-ripple to="/" exact>
          <q-item-section avatar><q-icon name="sports_esports" /></q-item-section>
          <q-item-section>Game Tracker</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/deck">
          <q-item-section avatar><q-icon name="style" /></q-item-section>
          <q-item-section>Deck Detail</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/cards">
          <q-item-section avatar><q-icon name="search" /></q-item-section>
          <q-item-section>Search</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/shuffle">
          <q-item-section avatar><q-icon name="shuffle" /></q-item-section>
          <q-item-section>Shuffle</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/settings">
          <q-item-section avatar><q-icon name="settings" /></q-item-section>
          <q-item-section>Settings</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-drawer v-model="rightDrawerOpen" side="right" elevated>
      <DeckView />
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

