

<template>
  <div class="card-home">
    <Filters />
    <InfiniteScrollCardDetailList />
  </div>
</template>

<script>
import InfiniteScrollCardDetailList from 'components/cards/InfiniteScrollCardDetailList.vue'
import Filters from 'components/filter/Filters.vue'
import * as provider from 'src/js/card_provider.js'

export default {
  name: 'CardHome',
  components: {
    InfiniteScrollCardDetailList, Filters
  },
  props: ["query"],
  created() {
    provider.handleQuery(this.query)
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Montserrat&display=swap');
.card-home {
  font-family: Montserrat, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
