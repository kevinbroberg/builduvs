<script setup>
// The "no deck yet" prompt: import one, start from scratch, or go find one.
// Shared by the deck page and the deck drawer; `compact` fits the drawer.
import { ref } from 'vue'
import DeckDialog from './DeckDialog.vue'
import AddCardsDialog from './AddCardsDialog.vue'

defineProps({ compact: Boolean })

const addCardsOpen = ref(false)
</script>

<template>
  <div class="empty-state" :class="{ 'empty-state--compact': compact }">
    <p class="empty-state__text">Import a deck?</p>
    <DeckDialog />
    <p class="empty-state__text">or start from scratch</p>
    <q-btn push icon="search" label="Add Cards" @click="addCardsOpen = true" />
    <p class="empty-state__text">
      or browse
      <router-link to="/lists" class="locals-link">Local Championship decklists</router-link>
    </p>
  </div>
  <AddCardsDialog v-model="addCardsOpen" />
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
.empty-state--compact {
  padding: 2rem 1rem;
  gap: 0.75rem;
}
.empty-state--compact .empty-state__text {
  font-size: 1rem;
}
.empty-state--compact .locals-link {
  font-size: 0.9rem;
}
</style>
