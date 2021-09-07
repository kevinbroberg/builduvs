<template>
  <div class="scroll">
    <q-infinite-scroll @load="addMore" :offset="250">
      <UltraCardDetail
        v-for="(card, index) in scrolledCards"
        :key="index"
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

export default {
  name: "InfiniteScrollCardDetailList",
  components: {
    UltraCardDetail,
  },
  data() {
    return {
      scrollLimit: 3,
      scrollPageSize: 10,
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
      this.scrollLimit = index;
      // done()
    },
  },
  props: ["filteredCards"],
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
