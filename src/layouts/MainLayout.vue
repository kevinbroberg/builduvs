<script setup>
  import { ref } from 'vue'
  import { useStore } from 'vuex';
  import { useQuasar } from 'quasar'
  import DeckView from 'components/deck/DeckView.vue'
  import NamePicker from 'components/filter/NamePicker.vue'

  const store = useStore()

  const leftDrawerOpen = ref(false)
  const rightDrawerOpen = ref(false)

  function toggleLeftDrawer () {
    leftDrawerOpen.value = !leftDrawerOpen.value
  }
  function toggleRightDrawer () {
    rightDrawerOpen.value = !rightDrawerOpen.value
  }
</script>

<template>
  <q-layout view="hhr lpR fFf">

    <q-header reveal elevated class="bg-primary text-white" height-hint="98">
      <q-toolbar>
        <!-- <q-btn dense flat round icon="menu" @click="toggleLeftDrawer" /> -->

        <q-toolbar-title>
          <q-avatar>
            <!-- TODO make a SVG -->
            <img src="icons\icon-128x128.png">
          </q-avatar>
          BuildUVS
        </q-toolbar-title>
        <NamePicker />
        <q-btn dense flat round icon="table_view" @click="toggleRightDrawer" >
          <q-tooltip>View current deck</q-tooltip>
        </q-btn>
      </q-toolbar>

      <q-tabs align='left'>
        <q-route-tab to="/" label="Search" />
        <q-route-tab to="/deck" label="Deck Detail" />
        <q-route-tab to="/attack" label="Attack Tracker" />
      </q-tabs>
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
