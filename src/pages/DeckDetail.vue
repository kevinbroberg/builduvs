<script setup>
  import { ref, computed } from 'vue'
  const text = ref('')

  import { useStore } from 'vuex'
  import CardCard from 'src/components/cards/CardCard.vue'
  import SideboardCardCard from 'src/components/cards/SideboardCardCard.vue' // holy shit this is such bad practice

  const store = useStore()
  const deck = computed(() => store.getters['deck/getDeckList'] )
  const side = computed(() => store.getters['deck/getSideList'] )
  const face = computed(() => store.getters['deck/getFace'])
</script>

<template>
  <div class="q-pa-md row items-start q-gutter-md">
    <CardCard v-if=face :card="this.face" />
    <CardCard v-for="card in this.deck" v-bind:key=card?.name :card=card />
    <q-separator row />
    <SideboardCardCard v-for="card in this.side" v-bind:key=card?.name :card=card />
  </div>
</template>