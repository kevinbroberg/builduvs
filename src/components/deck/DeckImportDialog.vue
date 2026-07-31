<script setup>
import { cards } from 'src/js/card_provider.js'
import { ref, computed, watch } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { useCardeioStore } from 'src/stores/cardeio'

const cardeio = useCardeioStore()
const text = ref('')
const fileModel = ref(null)
const loading = ref(false)
const loadedDeckName = ref('')

const uvsultraPattern = /https?:\/\/uvsultra\.online\/deck\.php\?deck=(\w+)/
const cardeioPattern = /https?:\/\/play\.uvsgames\.com\/decks\/([a-f0-9]{24})/

const emit = defineEmits([...useDialogPluginComponent.emits])
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

// Virtual store that mirrors the deck store interface but accumulates data locally
// rather than writing to Pinia, so the main deck is not affected.
function createVirtualStore() {
  const deck = {}
  const side = {}
  let face = null
  return {
    get deck() { return deck },
    get side() { return side },
    get face() { return face },
    set face(v) { face = v },
    nuke() {
      Object.keys(deck).forEach(k => delete deck[k])
      Object.keys(side).forEach(k => delete side[k])
      face = null
    },
    increment(card) {
      if (card.type === 'character' && !face) { face = card; return }
      const count = deck[card.asset]?.qty || 0
      const max = card.limit || 4
      deck[card.asset] = { ...card, qty: Math.min(count + 1, max) }
    },
    incrementSide(card) {
      const count = side[card.asset]?.qty || 0
      const max = card.limit || 4
      side[card.asset] = { ...card, qty: Math.min(count + 1, max) }
    },
    setFace(card) { face = card },
    currentCardeioId: null,
    currentDeckName: '',
    currentDeckId: null,
    currentDeckFormat: null,
  }
}

watch(text, async (val) => {
  const trimmed = val.trim()

  const cardeioMatch = trimmed.match(cardeioPattern)
  if (cardeioMatch && cardeioMatch[0] === trimmed) {
    loading.value = true
    loadedDeckName.value = ''
    try {
      const vs = createVirtualStore()
      const { name } = await cardeio.pullDeck(cardeioMatch[1], vs)
      loadedDeckName.value = name
      text.value = ''
      emitParsed(vs, name)
    } catch (e) {
      console.log('Failed to fetch Cardeio deck', e)
    } finally {
      loading.value = false
    }
    return
  }

  const uvsMatch = trimmed.match(uvsultraPattern)
  if (!uvsMatch || uvsMatch[0] !== trimmed) return
  loading.value = true
  loadedDeckName.value = ''
  try {
    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(trimmed)}`)
    const html = await res.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const forumCode = doc.querySelector('textarea')?.value
    if (forumCode) {
      const nameMatch = forumCode.match(/\[b\]\[url=[^\]]+\](.+?)\[\/url\]\[\/b\]/)
      loadedDeckName.value = nameMatch?.[1] || 'Unknown deck'
      text.value = forumCode
    }
  } catch (e) {
    console.log('Failed to fetch UVSUltra deck', e)
  } finally {
    loading.value = false
  }
})

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
    text.value = isJson ? (tts2Text(raw) || raw) : raw
  }
  reader.readAsText(file)
})

const showInputComponents = computed(() => !!text.value)

function parseTextInto(vs) {
  let regex = /^\s*(\d+)x?\)? (.*?)\s*$/
  let sideboard = /\n\s*(sideboard|\[b\]Side)/i
  let trailingDigit = /\d$/

  let decks = text.value.split(sideboard)
  let splitDecks = decks.map(d => d.split('\n').map(s => s.match(regex)).filter(i => i))

  proc(splitDecks[0], (card) => vs.increment(card))
  proc(splitDecks[2], (card) => vs.incrementSide(card))

  function proc(deck, action) {
    if (!deck) return
    for (let idx in deck) {
      let match = deck[idx]
      let qty = Number.parseInt(match[1])
      let myName = match[2].toLowerCase()
      let myAlias = trailingDigit.test(myName) ? '' : (myName + 1)
      let actualCard = null
      for (let key in cards) {
        let tlc = cards[key].name.toLowerCase()
        if (tlc == myName || (myAlias && tlc == myAlias)) {
          actualCard = cards[key]
          break
        }
      }
      if (actualCard) {
        for (let i = 0; i < qty; ++i) action(actualCard)
      } else {
        console.log(`Missed ${myName}`)
      }
    }
  }
}

function emitParsed(vs, name) {
  onDialogOK({
    face: vs.face,
    deck: Object.values(vs.deck),
    side: Object.values(vs.side),
    name: name || 'Comparison Deck',
  })
}

function finalizeFromText() {
  const vs = createVirtualStore()
  parseTextInto(vs)
  emitParsed(vs, loadedDeckName.value || 'Comparison Deck')
}
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin loader-card">
      <q-card-section class="loader-scroll">
        <q-file filled v-model="fileModel" label="Upload deck">
          <q-tooltip>Loads a text or TTS.json deck into the text area below</q-tooltip>
        </q-file>

        <q-input outlined type="textarea" v-model="text"
          placeholder="Enter deck as text, upload a file, or paste a UVSUltra or carde.io deck link"
          class="loader-textarea"
          :loading="loading"
          :disable="loading"
        />
        <div v-if="loading" class="q-mt-sm text-caption text-grey">Fetching deck...</div>
        <q-chip v-if="loadedDeckName" icon="check_circle" color="positive" text-color="white" class="q-mt-sm">
          Loaded: {{ loadedDeckName }}
        </q-chip>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn color="primary" @click="finalizeFromText" v-if="showInputComponents" label="Load for comparison">
          <q-tooltip>Loads this deck for comparison without replacing your current deck</q-tooltip>
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
</style>
