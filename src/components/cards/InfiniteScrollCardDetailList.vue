<template>
  <div id="scroll-target-id">
    <q-infinite-scroll @load="addMore" :offset="500" :scroll-target="'scroll-target-id'">
      <!-- TODO use QList and QListItem -->
      <UltraCardDetail
        v-for="(card, i) in scrolledCards"
        :key="i"
        :data="card"
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
import UltraCardDetail from "./UltraCardDetail.vue";
import { filteredCards } from "assets/card_provider.js";

export default {
  name: "InfiniteScrollCardDetailList",
  components: {
    UltraCardDetail,
  },
  data() {
    return {
      filteredCards: filteredCards,
      scrollLimit: 1,
      scrollPageSize: 5,
    };
  },
  computed: {
    scrolledCards() {
      return this.filteredCards.slice(
        0,
        this.scrollLimit * this.scrollPageSize
      );
    },
  },
  methods: {
    addMore(index, done) {
      this.scrollLimit = index + 1;
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
