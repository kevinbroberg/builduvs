<script setup>
import { ref } from "vue";
import { useRoute } from "vue-router";
import { useDeckStore } from "src/stores/deck";
import { storeToRefs } from "pinia";
import DeckView from "src/components/deck/DeckView.vue";

const { hasDeck } = storeToRefs(useDeckStore());

// Route records for /lists are siblings (not nested), so router-link's own
// active matching won't highlight "Decklists" on a player page. Match by path.
const route = useRoute();
function isActive(path) {
  if (path === "/") return route.path === "/" || route.path === "/attack";
  return route.path === path || route.path.startsWith(path + "/");
}
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
        <q-item clickable v-ripple to="/" exact :class="{ 'menu-active': isActive('/') }">
          <q-item-section avatar><q-icon name="sports_esports" /></q-item-section>
          <q-item-section>Game Tracker</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/settings" :class="{ 'menu-active': isActive('/settings') }">
          <q-item-section avatar><q-icon name="settings" /></q-item-section>
          <q-item-section>Tracker Settings</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/lists" :class="{ 'menu-active': isActive('/lists') }">
          <q-item-section avatar><q-icon name="emoji_events" /></q-item-section>
          <q-item-section>Decklists</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/majors" :class="{ 'menu-active': isActive('/majors') }">
          <q-item-section avatar><q-icon name="military_tech" /></q-item-section>
          <q-item-section>Majors</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/deck" :class="{ 'menu-active': isActive('/deck') }">
          <q-item-section avatar><q-icon name="style" /></q-item-section>
          <q-item-section>Your Deck</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/cards" :class="{ 'menu-active': isActive('/cards') }">
          <q-item-section avatar><q-icon name="search" /></q-item-section>
          <q-item-section>Card Search</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/compare" :class="{ 'menu-active': isActive('/compare') }">
          <q-item-section avatar><q-icon name="difference" /></q-item-section>
          <q-item-section>Compare Decks</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/shuffle" :class="{ 'menu-active': isActive('/shuffle') }">
          <q-item-section avatar><q-icon name="shuffle" /></q-item-section>
          <q-item-section>Shuffle Tool</q-item-section>
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

<style scoped>
/* Highlight the drawer item for the current route */
.menu-active {
  color: var(--q-primary);
  font-weight: 600;
  background: rgba(25, 118, 210, 0.1);
  box-shadow: inset 3px 0 0 var(--q-primary);
}
.menu-active :deep(.q-icon) {
  color: var(--q-primary);
}
</style>

