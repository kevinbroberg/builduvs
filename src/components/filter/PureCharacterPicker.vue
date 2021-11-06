<script setup>
import { ref, computed, defineEmits, defineProps, watch } from 'vue'
import { filteredCards } from 'assets/card_provider.js'

// TODO change names for everything: maybe name the file SingleTypeSubselect
const myCards = ref(filteredCards.value.filter(c => c.type == props.type))//.filter(symbolFilter)

const options = computed(() => myCards.value
  .map(c => c.name)
//   .filter(name => name.toLowerCase().indexOf(extraFilter.value) > -1)
)

const emit = defineEmits( ['update:character'] )
const props = defineProps( {character: Object, label: String, type: String})



const pick = ref("")
watch(pick, (val, __) => {
  var possibles = myCards.value.filter(c => c.name == val)
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
