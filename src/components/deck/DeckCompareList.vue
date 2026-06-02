<script setup>
import { computed } from 'vue'
import { getCardImage } from 'src/js/image_helper'
import ManySymbols from 'components/cards/detail/ManySymbols.vue'

const props = defineProps({
  face: { type: Object, default: null },
  deckList: { type: Array, default: () => [] },
  sideList: { type: Array, default: () => [] },
})
const emit = defineEmits(['cardClick'])

const partitions = computed(() => {
  const typeMap = {}
  for (const card of props.deckList) {
    const t = card.type || 'unknown'
    if (!typeMap[t]) typeMap[t] = []
    typeMap[t].push(card)
  }
  const main = Object.entries(typeMap).map(([type, cards]) => {
    const qty = cards.reduce((sum, c) => sum + c.qty, 0)
    return { key: type, label: `${type}: ${qty}`, cards }
  })
  if (props.sideList?.length > 0) {
    const sideQty = props.sideList.reduce((sum, c) => sum + c.qty, 0)
    main.push({
      key: 'sideboard',
      label: `Sideboard: ${sideQty}`,
      cards: props.sideList.map(c => ({ ...c, type: 'sideboard' })),
    })
  }
  return main
})
</script>

<template>
  <div>
    <div v-if="face" class="row items-center q-pa-xs q-mb-xs card-list-character">
      <q-avatar square size="40px" class="q-mr-sm">
        <img :src="getCardImage(face.asset)" class="card-thumb__img" />
      </q-avatar>
      <span>{{ face.name }} <ManySymbols :resources="face.resources" /></span>
    </div>

    <q-list bordered>
      <div v-for="partition in partitions" :key="partition.key">
        <q-separator />
        <q-item-label header>{{ partition.label }}</q-item-label>
        <q-item v-for="card in partition.cards" :key="card.asset" no-wrap dense clickable
          :class="`card-list-${card.type}`" @click="emit('cardClick', card)">
          <q-item-section avatar>
            <q-avatar square class="card-thumb">
              <img :src="getCardImage(card.asset)" class="card-thumb__img" />
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label lines="2">{{ card.qty }} {{ card.name }}</q-item-label>
          </q-item-section>
        </q-item>
      </div>
    </q-list>
  </div>
</template>
