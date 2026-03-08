<script setup>
import { ref, computed, defineEmits, defineProps, watch } from 'vue'
// TODO provide separate streams of filtered cards with fully distinct selections
import { formatCards, symbolFilter1 } from 'src/js/card_provider.js'

const emit = defineEmits( ['update:choice'] )
const props = defineProps( {choice: Object, type: String, label: String})

const myCards = computed(() => formatCards.value.filter(c => c.type == props.type).filter(symbolFilter1))

const allOptions = computed(() => myCards.value.map(c => c.name))
const visibleOptions = ref([])

function filterFn(val, update) {
  update(() => {
    const needle = val.toLowerCase()
    visibleOptions.value = needle
      ? allOptions.value.filter(n => n.toLowerCase().includes(needle))
      : allOptions.value
  })
}

const pick = ref("")
watch(pick, (val, __) => {
  var possibles = myCards.value.filter(c => c.name == val)
  if(possibles.length == 1) {
    emit("update:choice", possibles[0])
  }
})
</script>


<template>
    <q-select v-model="pick" :options="visibleOptions"
      use-input input-debounce="0" @filter="filterFn"
      standout dense clearable
      :label="props.label || `Select a ${type}`" class="q-ml-sm" />
</template>