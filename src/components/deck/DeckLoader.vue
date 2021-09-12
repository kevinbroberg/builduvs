<template>
  <div id="deckLoader">
    <q-btn @click="loadDeck" v-if="showInputComponents" label="Finalize deck">
      <q-tooltip>Loads the deck from text into this app</q-tooltip>
    </q-btn>
    <q-file filled v-model="fileModel" @change="deck2Text($event)" label="Upload deck">
      <q-tooltip>Loads a text or TTS.json deck into the text area below</q-tooltip>
    </q-file>
    <q-input outlined autogrow type="textarea" v-model="text" placeholder="Enter deck as text"
      @fileLoaded="showTextLoadDeck($event)" />
    
  </div>
</template>

<script>
import cards from 'assets/cards.json'
export default {
  name: "DeckLoader",
  data() {
    return {
      text: '',
      fileModel: null,
      deckChanged: false
    }
  },
  computed: {
    showInputComponents() { return !!this.text }
  },
  methods: {
    showTextLoadDeck(ev) {
      this.text = ev
      this.loadDeck()
    },
    tts2Text(input) {
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
    },
    deck2Text(event) {
      const file = event.target.files[0];
      const reader = new FileReader();
      console.log(file)

      if (file.type == 'application/json') {
        // attempt to read as a tabletop simulator deck
        reader.onload = e => this.text = this.tts2Text(e.target.result);
      } else {
        reader.onload = e => this.text = e.target.result;
      }      
      reader.readAsText(file);
    },
    loadDeck() {
      // clear the previous contents
      this.$store.commit('deck/nuke')

      let regex = /^\s*(\d+)x?\)? (.*?)\s*$/
      let sideboard = /^\s*sideboard\s*$/i

      let decks = this.text.split(sideboard)
      let main = decks[0] // TODO load sideboard(s) as well
        .split('\n')
        .map(s => s.match(regex))
        .filter(i => i)
      for (let idx in main) {
        let match = main[idx]
        let qty = Number.parseInt(match[1])
        // O(N*C) where C is # cards in the 'database', N is # of cards in your deck. I assume this will be awful performance but NO PREMATURE OPTIMIZATION
        // later-me finds: it's not even fucking slow. damn it all
        let actualCard = null
        for (let key in cards) { 
          if (cards[key].name.toLowerCase() == match[2].toLowerCase()) { // TODO better case insensitive
            actualCard = cards[key]
            break;
          }
        }
        // console.log(`Actual card for ${match[2]}: ${actualCard}`)
        if (actualCard) {
          for(let i = 0 ; i < qty; ++i) {
            this.$store.commit('deck/increment', actualCard)
          }
        } else {
          console.log(`Missed ${key}`)
        }
      }

      this.text = ''
    }
  }
};
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