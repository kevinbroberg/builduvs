<script setup>
  import { ref } from 'vue'
  import { useDeckStore } from 'src/stores/deck'
  import { getCardImage } from 'src/js/image_helper'
  const props = defineProps({ card: Object, main: Boolean })
  const data = ref(props.card)

  const store = useDeckStore()

  const mainActions = {
    increment: () => store.increment(data.value),
    decrement: () => store.decrement(data.value),
    side: () => store.send2Board(data.value),
    quantity: () => store.quantity(data.value.asset)
  }
  const sideActions = {
    increment: () => store.incrementSide(data.value),
    decrement: () => store.decrementSide(data.value),
    side: () => store.send2Main(data.value),
    quantity: () => store.sideQuantity(data.value.asset)
  }
  const swapLabel = props.main ? 'Side' : 'Main'
  const actions = props.main ? mainActions : sideActions

 
</script>

<template>
<q-card>
  <q-img
    loading="lazy"
    fit="cover"
    :src="getCardImage(data.asset)"
    :alt="data.name">
    <div class="absolute-bottom" text-subtitle2 flex flex-center>
      {{actions.quantity() || ""}} {{data.name}}
    </div>
  </q-img>

  <q-btn-group spread push>
    <q-btn push col-4 color="positive" @click="actions.increment()" >Add</q-btn> 
    <q-btn push col-4 color="negative" @click="actions.decrement()">Remove</q-btn>
    <q-btn push col-4 color="accent"   @click="actions.side()"     >{{swapLabel}}</q-btn>
  </q-btn-group>
</q-card>
</template>