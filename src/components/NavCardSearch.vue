<script setup>
// The navbar's card search, available on every page. Picking a card opens its
// detail popup; Enter without picking opens the card browser on everything the
// text matches.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { cards } from 'src/js/card_provider'
import { createCardSearch, FUZZY_DELAY_MS } from 'src/js/card_search'
import { openCardDetail, showInCardBrowser } from 'src/js/card_detail'
import { getCardImage } from 'src/js/image_helper'

const router = useRouter()

// One entry per name (the newest printing; card files are newest first), so a
// reprint doesn't show up as several choices. The browser shows every printing.
let search = null
function index() {
  if (!search) {
    const seen = new Set()
    search = createCardSearch(cards.filter(c => !seen.has(c.name) && seen.add(c.name)))
  }
  return search
}

const options = ref([])
const find = (needle, fuzzyExtras) =>
  index().search(needle, { limit: 12, fuzzyExtras }).map(r => r.item)

// Fuzzy extras join the list once typing pauses.
let lateFuzzy = null
function filterFn(val, update) {
  clearTimeout(lateFuzzy)
  const needle = val.trim()
  update(() => {
    options.value = needle ? find(needle, false) : []
  })
  if (needle) lateFuzzy = setTimeout(() => { options.value = find(needle, true) }, FUZZY_DELAY_MS)
}

const field = ref(null)
function reset() {
  clearTimeout(lateFuzzy)
  field.value?.updateInputValue('', true)
  field.value?.blur()
  options.value = []
}

function onPick(card) {
  if (!card) return
  reset()
  openCardDetail(card)
}

// Enter with no option highlighted.
function onEnter(val, done) {
  done()
  if (!val.trim()) return
  reset()
  showInCardBrowser(router, val.trim())
}

// "/" focuses the search from anywhere that isn't already taking text.
function onKey(evt) {
  if (evt.key !== '/' || evt.ctrlKey || evt.metaKey || evt.altKey) return
  if (evt.target.closest?.('input, textarea, select, [contenteditable]')) return
  evt.preventDefault()
  field.value?.focus()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearTimeout(lateFuzzy)
})
</script>

<template>
  <q-select ref="field" class="nav-card-search" dense dark standout="bg-white text-dark"
    :options-dark="false" use-input hide-selected hide-dropdown-icon
    :model-value="null" :options="options" option-label="name" input-debounce="150"
    placeholder="Search cards…" @filter="filterFn" @update:model-value="onPick" @new-value="onEnter">
    <template #prepend><q-icon name="search" size="20px" /></template>
    <template #option="{ opt, itemProps }">
      <q-item v-bind="itemProps" dense>
        <q-item-section avatar>
          <q-img :src="getCardImage(opt.asset)" :ratio="59 / 86" width="28px" fit="contain" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ opt.name }}</q-item-label>
          <q-item-label caption>{{ opt.type }} · {{ opt.extension_short || opt.extension }}</q-item-label>
        </q-item-section>
      </q-item>
    </template>
    <template #no-option>
      <q-item dense><q-item-section class="text-grey">No matches</q-item-section></q-item>
    </template>
  </q-select>
</template>

<style scoped>
.nav-card-search {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 360px;
  margin-left: 12px;
}
</style>
