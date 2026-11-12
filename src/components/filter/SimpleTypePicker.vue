<script setup>
import { ref, computed, defineEmits, defineProps, watch } from 'vue'
// TODO provide separate streams of filtered cards with fully distinct selections
import { formatCards, symbolFilter1 } from 'src/js/card_provider.js'

const emit = defineEmits( ['update:choice'] )
// `initial`: a card name to prefill. It's the ref's starting value, so the
// watcher below never sees it and no update:choice is emitted for it.
const props = defineProps( {choice: Object, type: String, label: String, initial: String})

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

const pick = ref(props.initial || "")
function emitChoice(val) {
  var possibles = myCards.value.filter(c => c.name == val)
  if(possibles.length == 1) {
    emit("update:choice", possibles[0])
  }
}
watch(pick, (val, __) => emitChoice(val))

// QSelect doesn't emit when you pick the option that's already selected, so the
// watcher never fires for it. Treat re-clicking the current choice (e.g. a
// prefilled `initial`) as choosing it again.
function onOptionClick(opt) {
  if (opt === pick.value) emitChoice(opt)
}
</script>


<template>
    <q-select v-model="pick" :options="visibleOptions"
      use-input input-debounce="0" @filter="filterFn"
      standout dense clearable
      :label="props.label || `Select a ${type}`" class="q-ml-sm">
      <template #option="scope">
        <!-- Check before QSelect's own onClick runs: it updates `pick` synchronously,
             which would make a genuinely new choice look like a re-pick. -->
        <q-item v-bind="{ ...scope.itemProps, onClick: () => { onOptionClick(scope.opt); scope.itemProps.onClick() } }">
          <q-item-section>
            <q-item-label>{{ scope.opt }}</q-item-label>
          </q-item-section>
        </q-item>
      </template>
    </q-select>
</template>