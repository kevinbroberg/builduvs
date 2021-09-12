<template>
  <div id="app">    
    <div id="options"> <!-- TODO Use a QList here-->
      <div>
        <multiselect v-model="nameSelection" :options="nameOptions"
          tag-placeholder="Search with this name (or regex!)" :taggable="true" @tag="addNameTag"
          :close-on-select="true" :clear-on-select="false"
          :searchable="true" placeholder="Filter by name">
        </multiselect>
      </div>
      <div>
        <multiselect v-model="selectedSymbols" :options="symbolOptions" :multiple="true" :close-on-select="false" :customLabel="initialCap"
            :clear-on-select="false" :searchable="false" placeholder="Filter by symbol">
        </multiselect>
      </div>
      <div>
        <multiselect v-model="selectedSymbols2" :options="symbolOptions" :multiple="true" :close-on-select="false" :customLabel="initialCap"
            :clear-on-select="false" :searchable="false" placeholder="Filter by symbol">
        </multiselect>
      </div>
      <div>
        <multiselect v-model="selectedSymbols3" :options="symbolOptions" :multiple="true" :close-on-select="false" :customLabel="initialCap"
            :clear-on-select="false" :searchable="false" placeholder="Filter by symbol">
        </multiselect>
      </div>
      <div>
        <multiselect @close="selectedOrigins = $event" v-model="indirectOrigins" :options="originOptions" :multiple="true" :close-on-select="false" 
            :clear-on-select="false" :searchable="true" placeholder="Filter by set">
        </multiselect>
      </div>
      <div>
        <multiselect v-model="selectedTypes" :options="typeOptions" :multiple="true" :close-on-select="false" :customLabel="initialCap"
            :clear-on-select="false" :searchable="true" placeholder="Filter by card type">
        </multiselect>
      </div>
      <div>
        <multiselect @close="selectedKeywords = $event" v-model="indirectKeywords" :options="keywordOptions" :multiple="true" :close-on-select="false"
            tag-placeholder="Search keywords" :taggable="true" @tag="addKeywordTag"
            :clear-on-select="false" :searchable="true" placeholder="Filter by keyword">
        </multiselect>
      </div>
      <div>
        <multiselect v-model="textSelection" :options="textOptions"
          tag-placeholder="Search for text" :taggable="true" @tag="addTextTag"
          :close-on-select="true" :clear-on-select="false"
          :searchable="true" placeholder="Filter by text">
        </multiselect>
      </div>
      <div>
        <multiselect v-model="selectedFormats" :options="formatOptions" :multiple="true" :close-on-select="false" :customLabel="initialCap"
            :clear-on-select="false" :searchable="true" placeholder="Filter by format">
        </multiselect>
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
import Multiselect from 'vue-multiselect'
import cards from 'assets/cards.json'

export default {
  name: 'Home',
  components: {
    Multiselect,
    InfiniteScrollCardDetailList
  },
  props: ["query"],
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
      // don't immediately filter these after another selection
      indirectOrigins: [],
      indirectKeywords: [],
      nameTags: [],
      keywordTags: [],
      textTags: [],
      cardData: cards
    }
  },
  computed: {
    filteredCards() {
      return this.cardData.filter(card => this.allFiltersMatch(card))
    },
    resultsCount() {
      return this.filteredCards.length
    },
    typeOptions() {
      // not reactive at all
      return [...new Set(this.cardData.map(card => card.type))].sort()
    },
    nameOptions() {
      return [...this.nameTags, ...this.filteredCards.map(c => c.name)]
    },
    textOptions() {
      return ["NONE", ...this.textTags, ...new Set(this.filteredCards.map(c => c.text))]
    },
    formatOptions() {
      return [...new Set(this.filteredCards.map(card => card.formats).flat())]
    },
    keywordOptions() {
      // indirected - doesn't immediately update on changes
      return [...this.keywordTags, ...new Set(this.filteredCards.map(card => card.keywords).flat())].sort()
    },
    originOptions() {
      // indirected - doesn't immediately update on changes
      return [...new Set(this.filteredCards.map(card => card.extension))]
    },
  },
  methods: {
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
        let fields = ["nameSelection",
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
    formatMatchFilter(card) {
        if (this.selectedFormats && this.selectedFormats.length > 0) {
          return card.formats && 
            card.formats.some(format => this.selectedFormats.includes(format))
        } else {
          return true
        }
    },
    addNameTag(newTag) {
      let tag = {
        name: newTag,
        code: Math.floor((Math.random() * 10000000))
      }
      this.nameTags.push(tag)
      this.nameSelection = newTag
    },
    addTextTag(newTag) {
      let tag = {
        name: newTag,
        code: Math.floor((Math.random() * 10000000))
      }
      this.textTags.push(tag)
      this.textSelection = newTag
    },
    addKeywordTag(newTag) {
      let tag = {
        name: newTag,
        code: Math.floor((Math.random() * 10000000))
      }
      this.keywordTags.push(tag)
      this.selectedKeywords.push(newTag)
    },
    nameFilter(card) {
      if (this.nameSelection && this.nameSelection.length > 0) {
        let frontanchor = this.nameSelection.startsWith('^') ? '^' : '.*'
        let backanchor = this.nameSelection.endsWith('$') ? '$' : '.*'
        const regex = new RegExp(frontanchor + this.nameSelection + backanchor, 'i')
        return regex.test(card.name)
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
        return card.keywords && card.keywords.some(cardKeyword => this.selectedKeywords.some(choice => cardKeyword.includes(choice)))
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
                     this.symbolFilterGenerator(this.selectedSymbols), 
                     this.symbolFilterGenerator(this.selectedSymbols2), 
                     this.symbolFilterGenerator(this.selectedSymbols3),
                     this.nameFilter,
                     this.textFilter,
                     this.typeMatchFilter,
                     this.formatMatchFilter,
                     this.keywordFilter,
                     ]
      return filters.every(function(f) {
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

// the 3.0.0-alpha tarball isn't minified
<style src="vue-multiselect/dist/vue-multiselect.css"></style>
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
