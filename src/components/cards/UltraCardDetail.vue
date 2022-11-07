<template>
  <div
    class="row body"
    onmouseover="//preview('$extension', '$padded_numero');"
  >
    <!-- Title -->
    <div class="col-12">
      <h3 accent bolder v-if="amMain">{{card.name}}</h3>
      <h3 v-else>{{ card.name }}</h3>
    </div>
    
    <!-- Image + fundamentals section -->
    <div class="col-6 row no-wrap" @click="increment()">
      <!-- TODO onclick detail popup / dialog / lightbox -->
      <q-img class="col-8"
          :fit="'contain'"
          loading="lazy"
          style="height: 600; width: 300px"
          :src="require('assets/images/card_images/' + this.card.asset)"
          :alt="card.name"
          
      />
      <div class="col-4">
        <span :class="'card-list-' + card.type">{{card.type}}</span><br />
        <Elements v-bind:resources="card.resources" /> <br />
        {{ card.difficulty }} Difficulty {{ card.control }} Control<br />
        <BlockData v-bind:card="card" />
        <AttackData v-bind:card="card" />
        <div class="ischaracter" v-if="isCharacter()">
          Handsize : {{ card["hand_size"] }} <br />
          Vitality : {{ card["vitality"] }} <br />
        </div>
        {{ card.rarity || "" }}
        <span v-if="myQty > 0" class="bg-positive">Quantity in Deck {{ myQty }}</span>
      </div>
    </div>

    <div class="col-sm-6 col-xs-12 col-grow">
      <!-- TODO onclick detail popup / dialog / lightbox -->
      <h4>{{ (card.keywords ? card.keywords : []).join(" - ") }}</h4>
      <h6 style="margin: 0px 15px">{{ card.text || "Missing text" }}</h6>
      <q-btn v-if="card.rochester_url" type="a" :href="'https://www.rochesterccg.com' + card.rochester_url" target="_blank" label="Buy on RochesterCCG" color="orange" />
    </div>
    <q-separator />
</div>
</template>

<script>
import BlockData from "components/cards/detail/BlockData";
import AttackData from "components/cards/detail/AttackData";
import Elements from "components/cards/detail/Elements";
import { useStore } from "vuex";
import { computed } from "vue";

export default {
  name: "CardDetail",
  components: {
    BlockData,
    AttackData,
    Elements,
  },
  setup(props) {
    const $store = useStore();

    function isCharacter() {
      return props.card["type"] == "character";
    }

    function increment() {
      $store.commit("deck/increment", props.card);
    }

    function decrement() {
      $store.commit("deck/decrement", props.card);
    }

    const myQty = computed(() => $store.getters["deck/quantity"](props.card.asset))

    const amMain = computed(() => $store.getters["deck/getMain"]?.name == props.card["name"])

    return {
        increment, decrement, isCharacter, myQty, amMain
    }
  },
  props: {
    card: Object,
  },
};
</script>

<style scoped>
body {
  font-family: arial;
  padding: 0;
  max-width: 1400px;
  margin: auto;
  background-color: #eee;
}

#options > div {
  margin: 10px 0px;
}
</style>
