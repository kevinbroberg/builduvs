<template>
  <div>
    <q-btn push @click="swapDisplay = !swapDisplay" :label=detailType.label>
      <q-tooltip>{{detailType.tip}}</q-tooltip>
    </q-btn>
  </div>
  <div id="scroll-target-id">
    <q-infinite-scroll class="row" @load="addMore" :offset=500 
      :scroll-target="'scroll-target-id'">
      <component :is=detailType.component
        :class=detailType.class
        v-for="(card, i) in scrolledCards"
        :key="i"
        v-bind="{card: card, main: true}"
      />
      <template v-slot:loading>
        <div class="row justify-center q-my-md">
          <q-spinner-dots color="primary" size="40px" />
        </div>
      </template>
    </q-infinite-scroll>
  </div>
</template>

<script>
import UltraCardDetail from "./UltraCardDetail.vue"
import CardCard from "./CardCard.vue"
import { filteredCards } from "assets/card_provider.js"
// import { shallowRef } from 'vue'

export default {
  name: "InfiniteScrollCardDetailList",
  components: {
    UltraCardDetail, CardCard
  },
  data() {
    return {
      swapDisplay: true,
      filteredCards: filteredCards,
      scrollLimit: 1,
      scrollPageSize: 6,
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
      return this.filteredCards.slice(
        0,
        this.scrollLimit * this.scrollPageSize
      );
    },
  },
  methods: {
    addMore(index, done) {
      this.scrollLimit = index;
      done()
    },
  },
  watch: {
    filteredCards: function(_, __) {
      // page froze up if user scrolled down then removed filters, as the page tried to render 100s of new cards
      console.log("Resetting scroll after search results changed")
      this.scrollLimit = 1
    }
  }
};
</script>

<style scoped>
button.page-link {
  display: inline-block;
  font-size: 20px;
  color: #29b3ed;
  font-weight: 500;
}
.offset {
  width: 500px !important;
  margin: 20px auto;
}
.scroll {
  overflow-anchor: none;
}
</style>
