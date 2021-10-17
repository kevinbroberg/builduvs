<script setup>
  import { ref, computed } from 'vue'
  const text = ref('')

  import { useStore } from 'vuex'
  import CardCard from 'src/components/cards/CardCard.vue'

  const store = useStore()
  const deck = computed(() => store.getters['deck/getDeckList'] )
  const side = computed(() => store.getters['deck/getSideList'] )
  const face = computed(() => store.getters['deck/getFace'])
</script>

<template>
  <div class="q-pa-md row items-start q-gutter-md">
    <div>
      <CardCard v-if=face :card="this.face" />
      
    </div>
    <CardCard v-for="card in this.deck" v-bind:key=card?.name :card=card :main=true />
    <q-separator row />
    <CardCard v-for="card in this.side" v-bind:key=card?.name :card=card :main=false />
  </div>
</template>