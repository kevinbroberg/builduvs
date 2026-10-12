<script setup>
import { parseDeckText } from 'src/js/deck_text.js'
import { ref, computed, defineEmits, watch } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { useDeckStore } from 'src/stores/deck'
import { useCardeioStore } from 'src/stores/cardeio'
const $store = useDeckStore()
const cardeio = useCardeioStore()
const text = ref('')
const fileModel = ref(null)

const cardeioPattern = /https?:\/\/play\.uvsgames\.com\/decks\/([a-f0-9]{24})/
const loading = ref(false)

watch(text, async (val) => {
  const trimmed = val.trim()

  const cardeioMatch = trimmed.match(cardeioPattern)
  if (cardeioMatch && cardeioMatch[0] === trimmed) {
    loading.value = true
    try {
      await cardeio.pullDeck(cardeioMatch[1], $store)
      text.value = ''
      onDialogOK()
    } catch (e) {
      console.log('Failed to fetch Cardeio deck', e)
    } finally {
      loading.value = false
    }
    return
  }

})


  const emit = defineEmits(
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    [...useDialogPluginComponent.emits]
  )
  
  // REQUIRED; must be called inside of setup()
  const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
// dialogRef      - Vue ref to be applied to QDialog
// onDialogHide   - Function to be used as handler for @hide on QDialog
// onDialogOK     - Function to call to settle dialog with "ok" outcome
//                    example: onDialogOK() - no payload
//                    example: onDialogOK({ /*.../* }) - with payload
// onDialogCancel - Function to call to settle dialog with "cancel" outcome
    
function tts2Text(input) {
  try {
    const myson = JSON.parse(input)
    // TTS nests objects arbitrarily. Collect each Deck (a pile of cards) separately
    // plus any loose cards (e.g. the character) so we can split main from sideboard.
    const decks = []
    const loose = {}
    const tally = (target, node) => {
      const name = node.Nickname.toLowerCase()
      target[name] = 1 + (target[name] || 0)
    }
    function walk(node, deckCounts) {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) { node.forEach(n => walk(n, deckCounts)); return }
      if (node.Name === 'Card' && node.Nickname) tally(deckCounts || loose, node)
      if (node.Name === 'Deck') {
        const counts = {}
        if (Array.isArray(node.ContainedObjects)) node.ContainedObjects.forEach(n => walk(n, counts))
        decks.push({ counts, total: Object.values(counts).reduce((a, b) => a + b, 0) })
        return
      }
      if (Array.isArray(node.ContainedObjects)) node.ContainedObjects.forEach(n => walk(n, deckCounts))
    }
    walk(myson.ObjectStates || myson, null)

    const merge = (target, src) => { for (const k in src) target[k] = (target[k] || 0) + src[k] }
    const main = {}
    let side = null
    if (decks.length >= 2) {
      // The smallest pile is the sideboard; everything else is the main deck.
      const sorted = [...decks].sort((a, b) => a.total - b.total)
      side = sorted[0].counts
      sorted.slice(1).forEach(d => merge(main, d.counts))
    } else if (decks.length === 1) {
      merge(main, decks[0].counts)
    }
    merge(main, loose)

    const lines = counts => Object.keys(counts).map(n => `${counts[n]} ${n}`).join('\n')
    if (!Object.keys(main).length && !(side && Object.keys(side).length)) return ''
    let out = lines(main)
    if (side && Object.keys(side).length) out += '\nSideboard\n' + lines(side)
    return out
  } catch (err) {
    console.log(err)
    return ''
  }
}

// Watch the q-file v-model directly (more reliable than the native @change event).
watch(fileModel, (file) => {
  if (!file) return
  const reader = new FileReader()
  const isJson = /\.json$/i.test(file.name) || file.type === 'application/json'
  reader.onload = e => {
    const raw = e.target.result
    // For JSON, try to parse as a TTS deck; fall back to the raw text if it isn't one.
    text.value = isJson ? (tts2Text(raw) || raw) : raw
  }
  reader.readAsText(file)
})

const showInputComponents = computed(() => !!text.value)

function replaceVuexDeck() {
  // clear the previous contents
  $store.nuke()

  const { main, side } = parseDeckText(text.value)
  for (const { card, qty } of main) for (let i = 0; i < qty; ++i) $store.increment(card)
  for (const { card, qty } of side) for (let i = 0; i < qty; ++i) $store.incrementSide(card)

  $store.currentDeckId = null
  $store.currentDeckName = 'Imported Deck'
  $store.currentDeckFormat = null
  $store.currentDeckModified = null

  onDialogOK()
}
</script>

<template>
<!-- notice dialogRef here -->

  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin loader-card">
      <q-card-section class="loader-scroll">
        <q-file filled v-model="fileModel" label="Upload deck">
            <q-tooltip>Loads a text or TTS.json deck into the text area below</q-tooltip>
        </q-file>

        <q-input outlined type="textarea" v-model="text"
          placeholder="Enter deck as text, upload a file, or paste a carde.io deck link"
          class="loader-textarea"
          :loading="loading"
          :disable="loading"
        />
        <div v-if="loading" class="q-mt-sm text-caption text-grey">Fetching deck...</div>
      </q-card-section>

      <!-- buttons example -->
      <q-card-actions align="right">
        <q-btn color="primary" @click="replaceVuexDeck" v-if="showInputComponents" label="Finalize deck">
          <q-tooltip>Loads the deck from text into this app</q-tooltip>
        </q-btn>
        <q-btn color="primary" label="Cancel" @click="onDialogCancel" />
      </q-card-actions>
    </q-card>

    
  </q-dialog>
</template>

<style>
.loader-card {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}
.loader-scroll {
  overflow-y: auto;
  flex: 1;
}
.loader-textarea .q-field__native {
  min-height: 200px;
  resize: vertical;
}
.load-input {
  position: relative;
  overflow: hidden;
  display: inline-block;

  /* Fancy button style 😎 */
  border: 2px solid black;
  border-radius: 5px;
  padding: 8px 12px;
  cursor: pointer;
}
.load-input input {
  position: absolute;
  top: 0;
  left: 0;
  z-index: -1;
  opacity: 0;
}
</style>