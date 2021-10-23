<script setup>
  import { ref } from 'vue'
  import { useStore } from 'vuex'
  const props = defineProps({ card: Object, main: Boolean })
  const data = ref(props.card)
  
  const store = useStore()
  const mainActions = {
    increment: ev => store.commit('deck/increment', data.value),
    decrement: ev => store.commit('deck/decrement', data.value),
    side: ev => store.commit('deck/send2Board', data.value)
  }
  const sideActions = {
    increment: ev => store.commit('deck/incrementSide', data.value),
    decrement: ev => store.commit('deck/decrementSide', data.value),
    side: ev => store.commit('deck/send2Main', data.value)
  }
  const swapLabel = props.main ? 'Side' : 'Main'
  const actions = props.main ? mainActions : sideActions

  // TODO hacky roll-my-own reactivity, figure out why the label doesn't update itself
  //  like it does in the sidebar DeckView. And TODO de-duplicate limiting logic
  const quantity = ref(data.value.qty || 0)
  function plus() { if(quantity.value < (props.card?.limit || 4)) { quantity.value ++ } }
  function minus() { if(quantity.value > 0) { 
    quantity.value -- 
  } }
</script>

<template>
<q-card>
  <q-img
    loading="lazy"
    fit="cover"
    :src="require('assets/images/card_images/' + data.asset)"
    :alt="data.name">
    <div class="absolute-bottom" text-subtitle2 flex flex-center>
      {{quantity || ""}} {{data.name}}
    </div>
  </q-img>

  <q-btn-group spread push>
    <q-btn push col-4 color="positive" @click="actions.increment(); plus()" >Add</q-btn> 
    <q-btn push col-4 color="negative" @click="actions.decrement(); minus()">Remove</q-btn>
    <q-btn push col-4 color="accent"   @click="actions.side(); minus()"     >{{swapLabel}}</q-btn>
  </q-btn-group>
</q-card>
</template>