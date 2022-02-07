<script setup>
  import { ref, computed } from 'vue'
  const text = ref('')

  import { useStore } from 'vuex'
  import CardCard from 'src/components/cards/CardCard.vue'
  import UltraCardDetail from 'src/components/cards/UltraCardDetail.vue'

  const store = useStore()
  const deck = computed(() => store.getters['deck/getDeckList'] )
  const side = computed(() => store.getters['deck/getSideList'] )
  const face = computed(() => store.getters['deck/getFace'])
</script>

<template>
  <div class="row items-start q-gutter-md">
    <div center row v-if=face>
      <UltraCardDetail :card="face" />
    </div>
    <q-separator />
    <CardCard v-for="card in deck" v-bind:key=card?.name :card=card :main=true />
  </div>
  <h3>Sideboard</h3>
  <div class="row items-start q-gutter-md">
    <CardCard v-for="card in side" v-bind:key=card?.name :card=card :main=false />
  </div>
</template>