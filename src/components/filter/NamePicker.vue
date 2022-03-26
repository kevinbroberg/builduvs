<script setup>
  import { ref, defineProps } from 'vue'
  import * as provider from 'src/js/card_provider.js'

  // TODO make this a prop, and emit value updates
  const selections = provider.selections
  const history = ref([])
  function add(val, done) {
    history.value.push(val)
    done(val)
  }
  
  const props = defineProps({ label: String})
  
</script>
<template>
    <q-select v-model="selections.name" :options=history
      @new-value="add"
      use-input standout dense clearable
      new-value-mode="add" 
      :label="props.label || 'Search by name'" class="q-ml-sm"  />
</template>