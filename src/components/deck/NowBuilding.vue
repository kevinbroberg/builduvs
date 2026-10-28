<script setup>
// Header badge for the deck in progress: the face's avatar with the deck's main
// symbol pinned to it, and the deck's name under a "Now building" eyebrow.
// The text drops away on phones, leaving just the avatar.
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDeckStore } from 'src/stores/deck'
import { mainSymbolOf, deckSymbolLabel } from 'src/js/deck_symbol'
import CardAvatar from 'src/components/cards/CardAvatar.vue'
import ResourceSymbol from 'src/components/cards/detail/ResourceSymbol.vue'

const store = useDeckStore()
const { face, currentDeckName } = storeToRefs(store)

const mainSymbol = computed(() => mainSymbolOf(face.value, store.getDeckList))

// An unnamed deck is better known by its character than by "Untitled Deck".
const title = computed(() => {
  const named = currentDeckName.value && currentDeckName.value !== 'Untitled Deck'
  if (named || !face.value) return currentDeckName.value || 'Untitled Deck'
  return face.value.name.split(',')[0]
})

const tooltip = computed(() => {
  const parts = [title.value]
  if (face.value && face.value.name.split(',')[0] !== title.value) parts.push(face.value.name)
  if (mainSymbol.value) parts.push(deckSymbolLabel(mainSymbol.value))
  return parts.join(' · ')
})
</script>

<template>
  <q-btn flat no-caps class="now-building" padding="2px 10px 2px 4px">
    <div class="now-building__face">
      <CardAvatar v-if="face" :card="face" size="38px" />
      <div v-else class="now-building__blank">
        <q-icon name="style" size="20px" />
      </div>
      <div v-if="mainSymbol" class="now-building__symbol">
        <ResourceSymbol :element="mainSymbol" size="16px" />
      </div>
    </div>
    <div class="now-building__text gt-xs">
      <div class="now-building__eyebrow">Now building</div>
      <div class="now-building__name ellipsis">{{ title }}</div>
    </div>
    <q-tooltip>{{ tooltip }}</q-tooltip>
  </q-btn>
</template>

<style scoped>
.now-building {
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.12);
}
.now-building :deep(.q-btn__content) {
  flex-wrap: nowrap;
  gap: 10px;
}
.now-building__face {
  position: relative;
  width: 38px;
  height: 38px;
  flex: none;
}
.now-building__blank {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px dashed rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}
/* The main symbol rides the avatar's lower-right edge, like a status badge. */
.now-building__symbol {
  position: absolute;
  right: -5px;
  bottom: -4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.now-building__text {
  text-align: left;
  line-height: 1.15;
  min-width: 0;
}
.now-building__eyebrow {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
}
.now-building__name {
  font-size: 14px;
  font-weight: 700;
  max-width: 180px;
}
</style>
