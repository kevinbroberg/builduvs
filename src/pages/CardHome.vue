<template>
  <div id="app">
    <div id="options"> <!-- TODO Use a QList here-->
      <div>
        <body>Symbols. AND across lines, OR within a line</body>
        <q-option-group v-model="selectedSymbols" :options="groupOptions(symbolOptions)" 
          inline multiple dense type="checkbox"/>
        <q-separator />
        <q-option-group v-model="selectedSymbols2" :options="groupOptions(symbolOptions)" 
          inline multiple dense type="checkbox"/>
        <q-separator />
        <q-option-group v-model="selectedSymbols3" :options="groupOptions(symbolOptions)" 
          inline multiple dense type="checkbox"/>
        <q-separator />
        <q-option-group v-model="selectedTypes" :options="groupOptions(typeOptions)" 
          inline multiple dense type="checkbox"/>
        <q-separator />
        <q-option-group v-model="selectedFormats" :options="groupOptions(formatOptions)" 
          inline multiple dense type="checkbox"/>
        <q-separator />
        <body>Difficulty</body>
        <q-option-group v-model="selectedDifficulty" :options="numberOptions(difficulties)" 
          inline multiple dense type="checkbox"/>
        <q-separator />
        <body>Control</body>
        <q-option-group v-model="selectedControl" :options="numberOptions(controls)" 
          inline multiple dense type="checkbox"/>
      </div>
      <div>
        <q-select v-model="selectedOrigins" :options="originOptions" standout dense stack-label 
          use-chips multiple label="Search expansions">
        </q-select>
      </div>
      <div>
        <!-- @update:model-value="addKeywordTag" -->
        <q-select v-model="selectedKeywords" :options="keywordOptions" standout dense stack-label 
          use-chips multiple use-input clearable 
          new-value-mode="add" placeholder="Search keywords">
        </q-select>
      </div>
      <div>
        <!-- @update:model-value="addTextTag" -->
        <q-select v-model="textSelection" :options="textOptions" standout dense 
          use-input clearable 
          new-value-mode="add" label="Search text">
        </q-select>
      </div>
      <button v-if="resultsCount > 200" type="button">{{resultsCount}} Cards in Search</button>
      <button v-if="resultsCount <= 200" @click="addAllToDeck" type="button">Add All {{resultsCount}} Cards to your Deck</button>
      <button @click="clearFilters" type="button">Clear Filters</button>
      <button @click="copyFilterLink" type="button">Copy Link to These Filters</button>
    </div>
    <InfiniteScrollCardDetailList v-bind:filteredCards="filteredCards"/>
  </div>
</template>

<script>
import InfiniteScrollCardDetailList from 'components/cards/InfiniteScrollCardDetailList'
import { cards } from 'assets/card_provider.js'

export default {
  name: 'Home',
  components: {
    InfiniteScrollCardDetailList
  },
  props: ["query"],
  created() {
    // TODO push up
    this.$store.commit('filter/handleQuery', this.query)
  },
  data() {
    return {
      // just straight nonreactive, would need to be indirected otherwise
      symbolOptions: ["air", "all", "chaos", "death", "earth", "evil", "fire", "good", "infinity", "life", "order", "void", "water"],
      // selections. quote-stripping from https://stackoverflow.com/questions/19156148/i-want-to-remove-double-quotes-from-a-string
      nameSelection: this.query.nameSelection       ? this.stripQuotes(this.query.nameSelection) : '',
      textSelection: this.query.textSelection       ? this.stripQuotes(this.query.textSelection) : '',
      selectedSymbols: this.query.selectedSymbols   ? JSON.parse(this.query.selectedSymbols) : [],
      selectedSymbols2: this.query.selectedSymbols2 ? JSON.parse(this.query.selectedSymbols2) : [],
      selectedSymbols3: this.query.selectedSymbols3 ? JSON.parse(this.query.selectedSymbols3) : [],

      selectedOrigins: this.query.selectedOrigins   ? JSON.parse(this.query.selectedOrigins) : [],
      selectedTypes:   this.query.selectedTypes     ? JSON.parse(this.query.selectedTypes) : [],
      selectedKeywords: this.query.selectedKeywords ? JSON.parse(this.query.selectedKeywords) : [],
      selectedFormats: this.query.selectedFormats   ? JSON.parse(this.query.selectedFormats) : ["standard"],
      selectedDifficulty: [],
      selectedControl: [],
      keywordTags: [],
      textTags: [],
      cardData: cards // why do i need to reassign this 🤔
    }
  },
  computed: {
    filteredCards() {
      return this.$store.getters['filter/filteredCards'].filter(card => this.allFiltersMatch(card))
    },
    resultsCount() {
      return this.filteredCards.length
    },
    difficulties() {
      return [...new Set(this.filteredCards.map(card => card.difficulty))].sort()
    },
    controls() {
      return [...new Set(this.filteredCards.map(card => card.control))].sort()
    },
    typeOptions() {
      return [...new Set(this.filteredCards.map(card => card.type))].sort()
    },
    nameOptions() {
      return [...this.filteredCards.map(c => c.name)]
    },
    textOptions() {
      return ["NONE", ...this.textTags, ...new Set(this.filteredCards.map(c => c.text))]
    },
    formatOptions() {
      return [...new Set(this.cardData.map(card => card.formats).flat())]
    },
    keywordOptions() {
      return [...this.keywordTags, ...new Set(this.filteredCards.map(card => card.keywords).flat())].sort()
    },
    originOptions() {
      return [...new Set(this.filteredCards.map(card => card.extension))]
    },
  },
  methods: {
    groupOptions(list) { return list.map(o => ({ value: o, label: o && this.initialCap(o) })) },
    numberOptions(list) { return list.map(n => ({ value: n, label: n.toString() })) }, // TODO not durable against undefined inputs!
    stripQuotes(str) {
      if (str.charAt(0) === '"' && str.charAt(str.length -1) === '"') {
          return str.substr(1,str.length -2)
      }
      return str
    },
    addAllToDeck() {
        if (this.filteredCards.length > 200) {
            // TODO just don't show the button unless they meet this criteria? Show a different one instead?
            alert('200 card limit for bulk add. Please set more filters')
        } else {
            this.filteredCards.forEach(c => this.$store.commit('deck/increment', c))
        }
    },
    initialCap([first, ...rest]) { // I LOVE destructuring but this has bad edge case handling
      return first.toUpperCase() + rest.join('')
    },
    async copyFilterLink() {
        let fields = [
          // "nameSelection", // TODO it was moved out of this component
            "textSelection",
            "selectedSymbols",
            "selectedSymbols2",
            "selectedSymbols3",
            "selectedOrigins",
            "selectedTypes",
            "selectedKeywords",
            "selectedFormats"]
        let queryStr = fields.map(field => this[field] && this[field].length > 0 ?
                                  field + "=" + JSON.stringify(this[field]) : "")
            .filter(val => val.length > 0)
            .join("&")

        let filterLink = location.origin + "/#" + this.$route.path + '?' + queryStr // TODO this looks sus

        await navigator.clipboard.writeText(filterLink)
    },
    // all methods below relate to filtering
    symbolFilterGenerator(selections) {
      return (card) => {
        if (selections && selections.length > 0) {
          return card.resources.some(sym => selections.includes(sym.toLowerCase()))
        } else {
          return true
        }
      }
    },
    originMatchFilter(card) {
      if (this.selectedOrigins && this.selectedOrigins.length > 0) {
        return this.selectedOrigins.includes(card.extension)
      } else {
        return true
      }
    },
    typeMatchFilter(card) {
      if (this.selectedTypes && this.selectedTypes.length > 0) {
        return this.selectedTypes.includes(card.type)
      } else {
        return true
      }
    },
    difficultyFilter(card) {
      if (this.selectedDifficulty && this.selectedDifficulty.length > 0) {
        return this.selectedDifficulty.includes(card.difficulty)
      } else {
        return true
      }
    },
    controlFilter(card) {
      if (this.selectedControl && this.selectedControl.length > 0) {
        return this.selectedControl.includes(card.control)
      } else {
        return true
      }
    },
    formatMatchFilter(card) {
        if (this.selectedFormats && this.selectedFormats.length > 0) {
          return card.formats &&
            card.formats.some(format => this.selectedFormats.includes(format))
        } else {
          return true
        }
    },
    textFilter(card) {
      if (this.textSelection && this.textSelection.length > 0) {
        if (this.textSelection == "NONE") {
          return !card.text
        } else {
            let frontanchor = this.textSelection.startsWith('^') ? '^' : '.*'
            let backanchor = this.textSelection.endsWith('$') ? '$' : '.*'
            const regex = new RegExp(frontanchor + this.textSelection + backanchor, 'i')
            return regex.test(card.text)
        }
      } else {
        return true
      }
    },
    keywordFilter(card) {
      if (this.selectedKeywords && this.selectedKeywords.length > 0) {
        return card.keywords && card.keywords.some(cardKeyword => 
          this.selectedKeywords.some(choice => 
            cardKeyword.includes(choice)))
      } else {
        return true
      }
    },
    clearFilters() {
      this.nameSelection = ''
      this.textSelection = ''
      this.selectedSymbols = []
      this.selectedSymbols2 = []
      this.selectedSymbols3 = []
      this.selectedOrigins = []
      this.selectedTypes = []
      this.selectedFormats = []
      this.selectedKeywords = []
    },
    allFiltersMatch(card) {
      let filters = [
                     this.originMatchFilter,
                     this.difficultyFilter,
                     this.controlFilter,
                     this.symbolFilterGenerator(this.selectedSymbols),
                     this.symbolFilterGenerator(this.selectedSymbols2),
                     this.symbolFilterGenerator(this.selectedSymbols3),
                     this.textFilter,
                     this.typeMatchFilter,
                     this.formatMatchFilter,
                     this.keywordFilter,
                    //  this.$store.getters['filter/nameFilter'],
                     ]
      return filters.every(f => {
        try {
            return f(card)
        } catch (e) {
            console.error('Error on ' + card.name + ': ' + e.message)
            return false
        }
      })
    }
  }
}
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Montserrat&display=swap');
  #app {
    font-family: Montserrat, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #2c3e50;
    margin-top: 60px;

  }
</style>
