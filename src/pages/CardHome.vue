<template>
  <div id="app">
    <div id="options"> <!-- TODO Use a QList here-->
      <div>
        <body>Symbols. AND across lines, OR within a line</body>
        <q-option-group v-model="selections.symbols" :options="groupOptions(symbolOptions)" 
          inline multiple dense type="checkbox"/>
        <q-separator />
        <q-option-group v-model="selections.symbols2" :options="groupOptions(symbolOptions)" 
          inline multiple dense type="checkbox"/>
        <q-separator />
        <q-option-group v-model="selections.symbols3" :options="groupOptions(symbolOptions)" 
          inline multiple dense type="checkbox"/>
        <q-separator />
        <q-option-group v-model="selections.types" :options="groupOptions(typeOptions)" 
          inline multiple dense type="checkbox"/>
        <q-separator />
        <q-option-group v-model="selections.formats" :options="groupOptions(formatOptions)" 
          inline multiple dense type="checkbox"/>
        <q-separator />
        <body>Difficulty</body>
        <q-option-group v-model="selections.difficulty" :options="numberOptions(difficulties)" 
          inline multiple dense type="checkbox"/>
        <q-separator />
        <body>Control</body>
        <q-option-group v-model="selections.control" :options="numberOptions(controls)" 
          inline multiple dense type="checkbox"/>
      </div>
      <div>
        <q-select v-model="selections.extensions" :options="originOptions" standout dense stack-label 
          use-chips multiple label="Search extensions">
        </q-select>
      </div>
      <div>
        <!-- @update:model-value="addKeywordTag" -->
        <q-select v-model="selections.keywords" :options="keywordOptions" standout dense stack-label 
          use-chips multiple use-input clearable 
          new-value-mode="add" placeholder="Search keywords">
        </q-select>
      </div>
      <div>
        <!-- @update:model-value="addTextTag" -->
        <q-select v-model="selections.text" :options="textOptions" standout dense 
          use-input clearable 
          new-value-mode="add" label="Search text">
        </q-select>
      </div>
      <button v-if="resultsCount > 200" type="button">{{resultsCount}} Cards in Search</button>
      <button v-if="resultsCount <= 200" @click="addAllToDeck" type="button">Add All {{resultsCount}} Cards to your Deck</button>
      <button @click="clearFilters" type="button">Clear Filters</button>
      <button @click="copyFilterLink" type="button">Copy Link to These Filters</button>
    </div>
    <InfiniteScrollCardDetailList />
  </div>
</template>

<script>
import InfiniteScrollCardDetailList from 'components/cards/InfiniteScrollCardDetailList'
import * as provider from 'assets/card_provider.js'

export default {
  name: 'Home',
  components: {
    InfiniteScrollCardDetailList
  },
  props: ["query"],
  created() {
    provider.handleQuery(this.query)
  },
  data() {
    return {
      symbolOptions: ["air", "all", "chaos", "death", "earth", "evil", "fire", "good", "infinity", "life", "order", "void", "water"],
      keywordTags: [],
      textTags: [],
      selections: provider.selections,
    }
  },
  computed: {
    resultsCount() {
      return provider.filteredCards.value.length
    },
    difficulties() {
      return [...new Set(provider.formatCards.value.map(card => card.difficulty))].sort()
    },
    controls() {
      return [...new Set(provider.formatCards.value.map(card => card.control))].sort()
    },
    typeOptions() {
      return [...new Set(provider.formatCards.value.map(card => card.type))].sort()
    },
    textOptions() {
      return ["NONE", ...this.textTags, ...new Set(provider.filteredCards.value.map(c => c.text))]
    },
    formatOptions() {
      return [...new Set(provider.cards.map(card => card.formats).flat())]
    },
    keywordOptions() {
      return [...this.keywordTags, ...new Set(provider.filteredCards.value.map(card => card.keywords).flat())].sort()
    },
    originOptions() {
      return [...new Set(provider.formatCards.value.map(card => card.extension))]
    },
  },
  methods: {
    // The "undefined" workaround is not very good; the checkboxes don't function
    groupOptions(list) { return list.map(o => ({ value: o, label: o == undefined ? "Undefined" : this.initialCap(o) })) },
    numberOptions(list) { return list.map(n => ({ value: n, label: n == undefined ? "Undefined" : n.toString() })) },
    addAllToDeck() {
        if (provider.filteredCards.value.length > 200) {
            // TODO just don't show the button unless they meet this criteria? Show a different one instead?
            alert('200 card limit for bulk add. Please set more filters')
        } else {
            provider.filteredCards.value.forEach(c => this.$store.commit('deck/increment', c))
        }
    },
    initialCap([first, ...rest]) { // I LOVE destructuring but this handles edge cases badly
      return first.toUpperCase() + rest.join('')
    },
    async copyFilterLink() {
        let filterLink = location.origin + this.$route.path + '?' + provider.getFilterPath()
        await navigator.clipboard.writeText(filterLink)
    },
    clearFilters() {
      provider.initializeSelections()
    },
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
