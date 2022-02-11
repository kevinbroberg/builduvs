<script setup>
  import { ref } from 'vue'
  import { useStore } from 'vuex'
  const props = defineProps({ card: Object, main: Boolean })
  const data = ref(props.card)

  const store = useStore()
  
  const mainq = store.getters["deck/quantity"]
  const sideq = store.getters["deck/sideQuantity"]

  const mainActions = {
    increment: () => store.commit('deck/increment', data.value),
    decrement: () => store.commit('deck/decrement', data.value),
    side: () => store.commit('deck/send2Board', data.value),
    quantity: () => mainq(data.value.asset)
  }
  const sideActions = {
    increment: () => store.commit('deck/incrementSide', data.value),
    decrement: () => store.commit('deck/decrementSide', data.value),
    side: () => store.commit('deck/send2Main', data.value),
    quantity: () => sideq(data.value.asset)
  }
  const swapLabel = props.main ? 'Side' : 'Main'
  const actions = props.main ? mainActions : sideActions

 
</script>

<template>
<q-card>
  <q-img
    loading="lazy"
    fit="cover"
    :src="require('assets/images/card_images/' + data.asset)"
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