<script setup>
  import Selector from "./Selector"
  import Element from "components/cards/detail/Element"  
</script>

<template>
  <div id="app">
    <div id="options"> <!-- TODO Use a QList here-->
      <div>
        <body>Symbols. AND across lines, OR within a line</body>
          <Selector v-for="i in ['', '2', '3']" :key=i v-slot="{ selected }"
          v-model:picks="selections['symbols' + i]" :options=symbolOptions>
            {{selected}}<Element :element=selected />
          </Selector>
        <q-separator />
        <Selector v-model:picks="selections.types" :options="typeOptions"/>
        <q-separator />
        <Selector v-model:picks="selections.formats" :options="formatOptions" />
        <q-separator />
        <Selector v-model:picks="selections.rarity" :options="rarityOptions" />
        <q-separator />
        <body>Difficulty</body>
        <Selector v-model:picks="selections.difficulty" :options="difficulties" />
        <q-separator />
        <body>Control</body>
        <Selector v-model:picks="selections.control" :options="controls" />
      </div>
      <q-select v-model="selections.extensions" :options="originOptions" standout dense stack-label 
        use-chips multiple label="Select extensions">
      </q-select>
      <q-select v-model="selections.keywords" :options="keywordOptions" standout dense stack-label 
        use-chips multiple use-input clearable 
        new-value-mode="add" placeholder="Search keywords">
      </q-select>
      <q-select v-model="selections.text" :options="textOptions" standout dense 
        use-input clearable 
        new-value-mode="add" label="Search text">
      </q-select>
      <q-btn push v-if="resultsCount > 200">{{resultsCount}} Cards in Search</q-btn>
      <q-btn push v-if="resultsCount <= 200" @click="addAllToDeck">Add All {{resultsCount}} Cards to your Deck</q-btn>
      <q-btn push @click="clearFilters">Clear Filters</q-btn>
      <q-btn push @click="copyFilterLink">Copy Link to These Filters</q-btn>
    </div>
    <InfiniteScrollCardDetailList />
  </div>
</template>

<script>
import InfiniteScrollCardDetailList from 'components/cards/InfiniteScrollCardDetailList'
import { copyToClipboard } from 'quasar'
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
      symbolPicks: Array(13).fill(false),
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
    rarityOptions() {
      return [...new Set(provider.formatCards.value.map(card => card.rarity).flat())]
    },
    keywordOptions() {
      return [...this.keywordTags, ...new Set(provider.filteredCards.value.map(card => card.keywords).flat())].sort()
    },
    originOptions() {
      return [...new Set(provider.formatCards.value.map(card => card.extension))]
    },
  },
  methods: {
    identity(o) { return o == 0 || o },
    // The "undefined" workaround is not very good; the checkboxes don't function
    groupOptions(list) { return list.filter(this.identity).map(o => ({ value: o, label: o })) },
    numberOptions(list) { return list.filter(this.identity).map(n => ({ value: n, label: n.toString() })) },
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
      let chosenFormats = provider.selections.value.formats
      let linkMHA = this.$route.path.includes("mha") && chosenFormats.length == 1 && chosenFormats[0] == "My Hero Academia" // TODO magic string
      let skips = linkMHA ? ["formats"] : []
      let filterLink = location.origin + this.$route.path + '?' + provider.getFilterPath(skips)
      //http://localhost:8080/mha?formats=%5B%22My%20Hero%20Academia%22%5D
      await copyToClipboard(filterLink)
    },
    clearFilters() {
      provider.initializeSelections()
    },
    doSymbols() {
      this.selections.symbols = this.symbolOptions.map((sy, i) => this.symbolPicks[i] ? sy : null).filter(e => e)
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
