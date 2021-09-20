<template>
  <q-card
    class="ultra-card row"
    flat
    onmouseover="//preview('$extension', '$padded_numero');"
  >

      <q-card-section class="card_image" @click="increment()">
        <!-- TODO onclick detail popup / dialog / lightbox -->
        <q-img
          :fit="'contain'"
          :loading="'lazy'"
          style="height: 600; width: 300px"
          :src="require('assets/images/card_images/' + this.data.asset)"
          :alt="data.name"
        />
      </q-card-section>
      <q-card-section horizontal>
        <q-card-section>
          <h2>{{ data.name }}</h2>
        </q-card-section>
        <q-card-section >
          <span class="label" :class="'card-list-' + data.type">{{data.type}}</span><br />
          <Elements v-bind:resources="data.resources" /> <br />
          {{ data.difficulty }} Difficulty {{ data.control }} Control<br />
          <BlockData v-bind:card="data" />
          <AttackData v-bind:card="data" />
          <div class="ischaracter" v-if="isCharacter()">
            Handsize : {{ data["hand_size"] }} <br />
            Vitality : {{ data["vitality"] }} <br />
          </div>
        {{ data.rarity || "" }}
          <span v-if="myQty > 0" class="badge badge-success">Quantity in Deck {{ myQty }}</span>
        </q-card-section>
      </q-card-section>

      <q-card-section >
        <!-- TODO onclick detail popup / dialog / lightbox -->
        <h4>{{ (data.keywords ? data.keywords : []).join(" - ") }}</h4>
        <h6>{{ data.text || "Missing text" }}</h6>
        <br />
      </q-card-section>
      
      <q-separator />
  </q-card>
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
      return props.data["type"] == "character";
    }

    function increment() {
      $store.commit("deck/increment", props.data);
    }

    function decrement() {
      $store.commit("deck/decrement", props.data);
    }

    const myQty = computed(() => {
        let card = $store.state.deck.deck[props.data.asset];
        return card ? card.qty : 0;
      },
    );

    return {
        increment, decrement, isCharacter, myQty
    }
  },
  props: {
    data: Object,
  },
};
</script>

<style scoped>
.preview {
  max-height: 50;
  display: inline-block;
  margin: auto;
}

.card:hover {
  background-color: #989db3;
  cursor: pointer;
}

.cardstats {
  display: inline-block;
  width: 50;
}

.card-detail {
  background: #f4f4f4;
  padding: 10px;
  border-bottom: 1px #ccc dotted;
}

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
.card-list-character {
  background-color: #98a6e3;
}
.card-list-foundation {
  background-color: #b6a7a0;
}
.card-list-attack {
  background-color: #d25421;
}
.card-list-asset {
  background-color: #a3bf75;
}
.card-list-action {
  background-color: #7e9cc0;
}
.card-list-side {
  background-color: #999999;
}
</style>
