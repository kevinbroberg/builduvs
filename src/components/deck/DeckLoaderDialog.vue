<script setup>
import { cards } from 'src/js/card_provider.js'
import { ref, computed, defineEmits, watch } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { useDeckStore } from 'src/stores/deck'
import { useCardeioStore } from 'src/stores/cardeio'
const $store = useDeckStore()
const cardeio = useCardeioStore()
const text = ref('')
const fileModel = ref(null)
const deckChanged = ref(false)

const uvsultraPattern = /https?:\/\/uvsultra\.online\/deck\.php\?deck=(\w+)/
const cardeioPattern = /https?:\/\/play\.uvsgames\.com\/decks\/([a-f0-9]{24})/
const loading = ref(false)
const loadedDeckName = ref('')

watch(text, async (val) => {
  const trimmed = val.trim()

  const cardeioMatch = trimmed.match(cardeioPattern)
  if (cardeioMatch && cardeioMatch[0] === trimmed) {
    loading.value = true
    loadedDeckName.value = ''
    try {
      const { name } = await cardeio.pullDeck(cardeioMatch[1], $store)
      loadedDeckName.value = name
      text.value = ''
      onDialogOK()
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
    // Python implementation:
    // contained = data["ObjectStates"][0]
    // cards = [card["Nickname"].lower() for card in contained["ContainedObjects"]]
    // deck = ["{} {}".format(qty, name) for name, qty in Counter(cards).items()]
    let myson = JSON.parse(input)
    let contained = myson["ObjectStates"][0]["ContainedObjects"]
    console.log(contained)
    function reducer(prev, card) {
      let name = card["Nickname"].toLowerCase()
      prev[name] = 1 + (prev[name] || 0)
      return prev
    }
    const deck = contained.reduce(reducer, {})
    return Object.keys(deck).map( name => `${deck[name]} ${name}`).join('\n')
  } catch (err) {
    console.log(err)
    return ''
  }
}

function deck2Text(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  console.log(file)

  if (file.type == 'application/json') {
    // attempt to read as a tabletop simulator deck
    reader.onload = e => text.value = tts2Text(e.target.result);
  } else {
    reader.onload = e => text.value = e.target.result;
  }      
  reader.readAsText(file);
}

const showInputComponents = computed(() => !!text.value)

function replaceVuexDeck() {
  // clear the previous contents
  $store.nuke()

  let regex = /^\s*(\d+)x?\)? (.*?)\s*$/
  let sideboard = /\n\s*(sideboard|\[b\]Side)/i
  let trailingDigit = /\d$/

  let decks = text.value.split(sideboard)
  let splitDecks = decks.map(d => d.split('\n').map(s => s.match(regex)).filter(i => i))
  console.log(splitDecks)
  proc(splitDecks[0], (card) => $store.increment(card))
  // splitDecks[1] is the word sideboard
  proc(splitDecks[2], (card) => $store.incrementSide(card))
  function proc(deck, action) {
    for (let idx in deck) {
      let match = deck[idx]
      let qty = Number.parseInt(match[1])
      let myName = match[2].toLowerCase()
      let myAlias = trailingDigit.test(myName) ? '' : (myName + 1) // patch common problem with character names
      // O(N*C) where C is # cards in the 'database', N is # of cards in your deck. I assume this will be awful performance but NO PREMATURE OPTIMIZATION
      // later-me finds: it's not even fucking slow. damn it all
      let actualCard = null
      for (let key in cards) { 
        let tlc = cards[key].name.toLowerCase()
        if (tlc == myName || (myAlias && tlc == myAlias)) {
          actualCard = cards[key]
          break;
        }
      }
      if (actualCard) {
        for(let i = 0 ; i < qty; ++i) {
          action(actualCard)
        }
      } else {
        console.log(`Missed ${myName}`)
      }
    }
  }

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
        <q-file filled v-model="fileModel" @change="deck2Text($event)" label="Upload deck">
            <q-tooltip>Loads a text or TTS.json deck into the text area below</q-tooltip>
        </q-file>

        <q-input outlined type="textarea" v-model="text"
          placeholder="Enter deck as text, upload a file, or paste a UVSUltra or carde.io deck link"
          class="loader-textarea"
          :loading="loading"
          :disable="loading"
        />
        <div v-if="loading" class="q-mt-sm text-caption text-grey">Fetching deck from UVSUltra...</div>
        <q-chip v-if="loadedDeckName" icon="check_circle" color="positive" text-color="white" class="q-mt-sm">
          Loaded: {{ loadedDeckName }}
        </q-chip>
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