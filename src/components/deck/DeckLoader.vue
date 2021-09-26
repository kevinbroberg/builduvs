<script setup>
import { cards } from 'assets/card_provider.js'
import { ref, computed } from 'vue'
import { useStore } from 'vuex'
const $store = useStore()
const text = ref('')
const fileModel = ref(null)
const deckChanged = ref(false)
    
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
  $store.commit('deck/nuke')

  let regex = /^\s*(\d+)x?\)? (.*?)\s*$/
  let sideboard = /\s*sideboard\s*/i
  let trailingDigit = /\d$/

  let decks = text.value.split(sideboard)
  let splitDecks = decks.map(d => d.split('\n').map(s => s.match(regex)).filter(i => i))
  console.log(splitDecks)
  proc(splitDecks[0], (card) => $store.commit('deck/increment', card))
  proc(splitDecks[1], (card) => $store.commit('deck/increment', [card, $store.state.deck.side]))
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

  text.value = ''
}
</script>

<template>
  <div id="deckLoader">
    <q-btn @click="replaceVuexDeck" v-if="showInputComponents" label="Finalize deck">
      <q-tooltip>Loads the deck from text into this app</q-tooltip>
    </q-btn>
    <q-file filled v-model="fileModel" @change="deck2Text($event)" label="Upload deck">
      <q-tooltip>Loads a text or TTS.json deck into the text area below</q-tooltip>
    </q-file>
    <q-input outlined autogrow type="textarea" v-model="text" placeholder="Enter deck as text" />
    
  </div>
</template>

<script>
</script>

<style>
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