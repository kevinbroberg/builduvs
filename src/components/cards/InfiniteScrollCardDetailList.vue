<template>
  <div>
    <q-btn push @click="swapDisplay = !swapDisplay" :label=detailType.label>
      <q-tooltip>{{detailType.tip}}</q-tooltip>
    </q-btn>
  </div>
  <q-infinite-scroll ref="scroller" class="row" @load="addMore" :offset=1000>
    <component :is=detailType.component
      :class=detailType.class
      v-for="card in scrolledCards"
      :key="card.asset"
      v-bind="{card: card, main: true}"
    />
    <template v-slot:loading>
      <div class="row justify-center q-my-md">
        <q-spinner-dots color="primary" size="40px" />
      </div>
    </template>
  </q-infinite-scroll>
</template>

<script>
import UltraCardDetail from "./UltraCardDetail.vue"
import CardCard from "./CardCard.vue"
import { filteredCards } from "src/js/card_provider.js"

export default {
  name: "InfiniteScrollCardDetailList",
  components: {
    UltraCardDetail, CardCard
  },
  data() {
    return {
      swapDisplay: true,
      filteredCards: filteredCards,
      pages: 1,
      // A multiple of every tile row width (1, 2, 4, 6), so each page fills whole rows.
      scrollPageSize: 12,
    };
  },
  computed: {
    detailType() {
      return this.swapDisplay
        ? { label: "Show Details", tip: "View card details, one per row",
          component: CardCard, class: "col-lg-2 col-md-3 col-sm-6 col-xs-12" }
        : { label: "Show Tiles", tip: "View cards as tiles", component: UltraCardDetail}
    },
    scrolledCards() {
      return this.filteredCards.slice(0, this.pages * this.scrollPageSize);
    },
  },
  methods: {
    // Count pages here rather than trusting QInfiniteScroll's own index: that one
    // kept climbing while idle at the bottom and survived filter changes, so the
    // next load after a new search jumped straight to dozens of pages.
    addMore(_, done) {
      this.pages++
      done(this.scrolledCards.length >= this.filteredCards.length)
    },
  },
  watch: {
    filteredCards() {
      // page froze up if user scrolled down then removed filters, as the page tried to render 100s of new cards
      this.pages = 1
      this.$nextTick(() => {
        this.$refs.scroller?.reset()
        this.$refs.scroller?.resume()
      })
    }
  }
};
</script>
