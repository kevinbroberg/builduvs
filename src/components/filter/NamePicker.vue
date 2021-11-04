<script setup>
  import { computed, ref, defineProps } from 'vue'
  import * as provider from 'assets/card_provider.js'

  const selections = provider.selections
  const options = computed(() => provider.filteredCards.value
    .map(c => c.name)
    .filter(name => name.toLowerCase().indexOf(extraFilter.value) > -1)
  )
  
  const props = defineProps({ label: String})

  let extraFilter = ref('')
  function filterNames(val, update, abort) {
    update(() => extraFilter.value = val.toLowerCase())
  }
  
</script>
<template>
    <q-select v-model="selections.name" :options=options 
      use-input standout dense clearable
      new-value-mode="add" 
      :label="props.label || 'Search by name'" class="q-ml-sm" @filter=filterNames />
</template>