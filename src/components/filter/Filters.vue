<script setup>
  import Selector from "components/filter/Selector"
  import MultilineSelector from "components/filter/MultilineSelector"
  import Element from "components/cards/detail/Element"  
</script>
<template>
    <div id="options"> <!-- TODO Use a QList here-->
      <div>
          <Selector v-for="name in symbolListsToShow" :key=name
            v-model:picks="selections[name]" :options=symbolOptions
            name="Symbols" 
          >
            <!-- <template v-slot:label>
              <span class="col-1">
                Symbols <q-btn v-if="symbolMax < 3" dense @click="symbolMax++" label="And"/>
              </span>
            </template> -->
            <template v-slot:button="{selected}">{{selected}}<Element :element=selected /></template>
          </Selector>
        <q-separator />
        <Selector name="Type" v-model:picks="selections.types" :options="typeOptions"/>
        <q-separator />
        <Selector name="Format" v-model:picks="selections.formats" :options="formatOptions" />
        <q-separator />
        <Selector name="Rarity" v-model:picks="selections.rarity" :options="rarityOptions" />
        <q-separator />
        <Selector name="Difficulty" v-model:picks="selections.difficulty" :options="difficulties" />
        <q-separator />
        <Selector name="Control" v-model:picks="selections.control" :options="controls" />
        <span ref="block_stats">
          <Selector name="Block" v-model:picks="selections.block_modifier" :options="blockOptions" />
          <Selector name="Block zone" v-model:picks="selections.block_zone" :options="zoneOptions">
            <template v-slot:button="{selected}">{{selected}}<Element :element="selected + ' block'" /></template>
          </Selector>
        </span>
        <span ref="attack_stats">
          <Selector name="Damage" v-model:picks="selections.damage" :options="damageOptions" />
          <Selector name="Zone" v-model:picks="selections.attack_zone" :options="zoneOptions">
            <template v-slot:button="{selected}">{{selected}}<Element :element="selected + ' attack'" /></template>
          </Selector>
          <Selector name="Speed" v-model:picks="selections.speed" :options="speedOptions" />
        </span>
        <span ref="character_stats">
          <Selector name="Handsize" v-model:picks="selections.hand_size" :options="handOptions" />
          <Selector name="Health" v-model:picks="selections.vitality" :options="vitalityOptions" />
        </span>
        <MultilineSelector name="Keywords" v-model:picks="selections.keyword_picks" :options="keywordSelectOptions" :multi=2 />
        <Selector name="Keyword Count" v-model:picks="selections.keyword_count" :options="keywordCountOptions" />
        <!-- <MultilineSelector name="Extensions" v-model:picks="selections.extensions" :options="originOptions" lines=7 /> -->
      </div>
      <q-select v-model="selections.extensions" :options="originOptions" standout dense stack-label 
        use-chips multiple label="Select extensions">
      </q-select>
      <q-select v-model="selections.keyword_search" :options="keywordSearchOptions" standout dense stack-label 
        use-chips multiple use-input clearable 
        new-value-mode="add" placeholder="Advanced keyword search">
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
</template>


<script>
import { copyToClipboard } from 'quasar'
import * as provider from 'src/js/card_provider.js'

export default {
  name: 'Filters',
  data() {
    return {
      symbolOptions: provider.symbolOptions,
      formatOptions: provider.formatOptions,
      symbolMax: 1,
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
      return this.textTags
    },
    rarityOptions() {
      return this.getOptions("rarity")
    },
    keywordSearchOptions() {
      return [...this.keywordTags, ...new Set(provider.filteredCards.value.map(card => card.keywords).flat())].sort()
    },
    keywordSelectOptions() {
      return provider.mhaOnlySelected() ? provider.mha_keywords : provider.universus_keywords
    },
    originOptions() {
      return [...new Set(provider.formatCards.value.map(card => card.extension))]
    },
    blockOptions() {
      return this.getNumberOptions("block_modifier")
    },
    speedOptions() {
      return this.getNumberOptions("speed")
    },
    damageOptions() {
      return this.getNumberOptions("damage")
    },
    handOptions() {
      return this.getNumberOptions("hand_size")
    },
    vitalityOptions() {
      return this.getNumberOptions("vitality")
    },
    keywordCountOptions() {
      return [...new Set(provider.formatCards.value.map(card => card?.keywords?.length || 0))].sort()
    },
    zoneOptions() {
      return ["high", "mid", "low"]
    },
    symbolListsToShow() {
      return ["symbols", "symbols2", "symbols3"]
    }
  },
  methods: {
    getOptions(field) {
      return [...new Set(provider.formatCards.value.map(card => card[field]))].filter(e => e != undefined).sort()
    },
    getNumberOptions(field) {
      return [...new Set(provider.formatCards.value.map(card => card[field]))]
        .filter(e => e != undefined).sort((a, b) => a - b)
    },
    addAllToDeck() {
      provider.filteredCards.value.forEach(c => this.$store.commit('deck/increment', c))
    },
    async copyFilterLink() {
      let linkMHA = provider.mhaOnlySelected()
      let skips = linkMHA ? ["formats"] : []
      let filterLink = location.origin + this.$route.path + '?' + provider.getFilterPath(skips)
      await copyToClipboard(filterLink)
    },
    clearFilters() {
      provider.initializeSelections()
    }
  }
}
</script>