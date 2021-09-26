<script setup>
  import * as provider from 'assets/card_provider.js'
  const selections = provider.selections
  const options = provider.filteredCards.value.slice(0, 15).map(c => c.name)
</script>
<template>
    <q-select v-model="selections.name" :options=options use-input standout dense clearable
          new-value-mode="add" label="Search by name" class="q-ml-sm" />
</template>