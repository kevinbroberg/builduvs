<template>
  <div id="deckLoader">      
    <button @click="loadDeck" v-if="deckChanged" type="button">Load Deck</button>
    <FileReader @fileLoaded="text = $event"></FileReader>
    <br/>
    <!-- TODO how tf am i supposed to style this for mobile? -->
    <textarea v-model="text" @input='deckChanged = true' @fileLoaded="showTextLoadDeck($event)" rows=20 cols=100></textarea>
    
  </div>
</template>

<script>
import FileReader from "./FileReader";
import cards from 'assets/cards.json'
export default {
  name: "DeckLoader",
  data() {
      return {
          text: '',
          deckChanged: false
      }
  },
  components: { FileReader },
  created() {
    this.text = Object.values(this.$store.state.deck.deck).map(c => '' + c.qty + ' ' + c.name).join('\n')
  },
  methods: {
    showTextLoadDeck(ev) {
      this.text = ev
      this.loadDeck()
    },
    loadDeck() {
      let regex = /^\s*(\d+)x?\)? (.*?)\s*$/
      let sideboard = /^\s*sideboard\s*$/i

      let decks = this.text.split(sideboard)
      let main = decks[0] // TODO load sideboard(s) as well
        .split('\n')
        .map(s => s.match(regex))
        .filter(i => i)
      // clear the previous contents
      this.$store.commit('deck/nuke')
      for (let idx in main) {
        let match = main[idx]
        let qty = Number.parseInt(match[1])
        // O(N*C) where C is # cards in the 'database', N is # of cards in your deck. I assume this will be awful performance but NO PREMATURE OPTIMIZATION
        // later-me finds: it's not even fucking slow. damn it all
        let actualCard = null
        for (let key in cards) { 
          if (cards[key].name.toLowerCase() == match[2].toLowerCase()) { // TODO better case insensitive
            console.log(`Found an actual match! ${cards[key]}`)
            actualCard = cards[key]
            break;
          }
        }
        // console.log(`Actual card for ${match[2]}: ${actualCard}`)
        if (actualCard) {
          for(let i = 0 ; i < qty; ++i) {
            this.$store.commit('deck/increment', actualCard)
          }
        }
      }

      this.deckChanged = false
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