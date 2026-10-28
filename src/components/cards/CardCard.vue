<script setup>
  import { ref } from 'vue'
  import { useDeckStore } from 'src/stores/deck'
  import { getCardImage } from 'src/js/image_helper'
  import ResourceSymbol from 'src/components/cards/detail/ResourceSymbol.vue'
  const props = defineProps({ card: Object, main: Boolean })
  const data = ref(props.card)

  const store = useDeckStore()

  const mainActions = {
    increment: () => store.increment(data.value),
    decrement: () => store.decrement(data.value),
    side: () => store.send2Board(data.value),
    quantity: () => store.quantity(data.value.asset)
  }
  const sideActions = {
    increment: () => store.incrementSide(data.value),
    decrement: () => store.decrementSide(data.value),
    side: () => store.send2Main(data.value),
    quantity: () => store.sideQuantity(data.value.asset)
  }
  const swapLabel = props.main ? 'Side' : 'Main'
  const actions = props.main ? mainActions : sideActions

  const CARD_RATIO = 744 / 1039  // card image width / height
</script>

<template>
<q-card>
  <!-- The ratio reserves the card's full height before the image arrives, so
       tiles don't grow under the reader and jolt the infinite scroll. -->
  <q-img
    loading="lazy"
    fit="cover"
    :ratio="CARD_RATIO"
    :src="getCardImage(data.asset)"
    :alt="data.name">
    <div class="absolute-bottom" text-subtitle2 flex flex-center>
      {{actions.quantity() || ""}} {{data.name}}
    </div>
    <template v-slot:loading>
      <div class="card-stub" :class="'card-list-' + data.type">
        <div class="card-stub__band" :class="'card-list-' + data.type">{{ data.type }}</div>
        <div class="card-stub__name">{{ data.name }}</div>
        <div v-if="data.keywords?.length" class="card-stub__keywords">{{ data.keywords.join(' · ') }}</div>
        <div v-if="data.type === 'attack'" class="card-stub__stats">
          <span><b>{{ data.speed ?? '–' }}</b> Speed</span>
          <span v-if="data.attack_zone">
            <b><ResourceSymbol :element="data.attack_zone" isAttackZone size="24px" /></b>
            {{ data.attack_zone }}
          </span>
          <span><b>{{ data.damage ?? '–' }}</b> Damage</span>
        </div>
        <div v-if="data.type === 'character'" class="card-stub__stats">
          <span><b>{{ data.hand_size ?? '–' }}</b> Hand</span>
          <span><b>{{ data.vitality ?? '–' }}</b> Vitality</span>
        </div>
        <div v-else class="card-stub__stats">
          <span v-if="data.difficulty != null"><b>{{ data.difficulty }}</b> Difficulty</span>
          <span v-if="data.control != null"><b>{{ data.control }}</b> Control</span>
          <!-- A backup's stamina is stored as `vitality`. -->
          <span v-if="data.type === 'backup' && data.vitality != null"><b>{{ data.vitality }}</b> Stamina</span>
        </div>
        <div v-if="data.block_zone" class="card-stub__stats">
          <span>
            <b>+{{ data.block_modifier ?? 0 }} <ResourceSymbol :element="data.block_zone" isBlockSymbol size="34px" /></b>
            {{ data.block_zone }} block
          </span>
        </div>
      </div>
    </template>
  </q-img>

  <q-btn-group spread push>
    <q-btn push col-4 color="positive" @click="actions.increment()" >Add</q-btn> 
    <q-btn push col-4 color="negative" @click="actions.decrement()">Remove</q-btn>
    <q-btn push col-4 color="accent"   @click="actions.side()"     >{{swapLabel}}</q-btn>
  </q-btn-group>
</q-card>
</template>

<style scoped>
/* Stand-in shown while the card image loads: its basic stats on a card-shaped panel. */
.card-stub {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  /* The type colour comes from the global .card-list-{type} background-color;
     this dark wash over it mutes the colour and keeps white text readable. */
  background-image: linear-gradient(160deg, rgba(28, 34, 48, 0.45), rgba(28, 34, 48, 0.8));
  color: #fff;
  text-align: center;
}
/* Types with no .card-list-* colour. */
.card-stub.card-list-token,
.card-stub.card-list-arena {
  background-color: #6b7280;
}
.card-stub__band {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 4px 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.card-stub__name {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
}
.card-stub__keywords {
  margin-top: -6px;
  font-size: 12px;
  font-style: italic;
  opacity: 0.7;
}
.card-stub__stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  opacity: 0.85;
  text-transform: capitalize;
}
.card-stub__stats:empty {
  display: none;
}
.card-stub__stats b {
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
}
</style>