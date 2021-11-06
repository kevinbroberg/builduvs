<script setup>
import { ref, computed, defineEmits, defineProps, watch } from 'vue'
import { filteredCards } from 'assets/card_provider.js'

const myCards = ref(filteredCards.value.filter(c => c.type == "character"))//.filter(symbolFilter)

const options = computed(() => myCards
  .map(c => c.name)
//   .filter(name => name.toLowerCase().indexOf(extraFilter.value) > -1)
)

const emit = defineEmits( ['update:character'] )
const props = defineProps( {character: Object, label: String})



const pick = ref("")
watch(pick, (val, __) => {
  var possibles = myCards.filter(c => c.name == val)
  if(possibles.length == 1) {
    emit("update:character", possibles[0])
  }
})
</script>


<template>
    <q-select v-model="pick" :options=options
      standout dense clearable
      :label="props.label || 'Select a character'" class="q-ml-sm" />
</template>
