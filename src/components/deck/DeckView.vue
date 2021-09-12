<script setup> 
  import { ref, computed } from 'vue'
  import { useStore } from 'vuex';
  const store = useStore()
  const deck = computed(() => store.getters['deck/getDeck'] )
  const simple = "Simple", type = "Types", symbol = "Symbols"
  const partitionOptions = [simple, type, symbol]
  const howPartition = ref(type)

  function simplePartition() {
    return [{'key': 'all', 'label': 'Deck', 'cards': deck.value}]
  }
  function symbolPartition() {
    throw 'Symbol partition not implemented'
  }
  function typePartition() {
    let myDeck = Object.keys(deck.value).map(k => deck.value[k]) // nondeterministic order is less than perfect...
    let types = new Set([...myDeck.map(card => card.type)])
    return [...types].map(me => {
      return {'key': me, 'label': me, 'cards': myDeck.filter(card => card.type === me)}
    })
  }
  
  const partitions = computed(() => {
    switch(howPartition.value) {
        case type:
          return typePartition()
        case simple:
        case symbol:
        default:
          return simplePartition()
    }
  })
</script>

<template>
  <q-select :options="partitionOptions" v-model="howPartition"/>
  <q-list bordered>
    <div v-for="partition in partitions" :key="partition.key">
      <q-separator/>
      <q-item-label header>{{partition.label}}</q-item-label>
      <q-item v-for="card in partition.cards" :key="card.asset">
        <q-item-section avatar>
          <q-avatar>
            <!-- TODO zoom into just the card art here -->
            <img :src="require(`assets/images/card_images/${card.asset}`)">
          </q-avatar>  
        </q-item-section>
        <q-item-section>
          <q-item-label lines="1">{{card.qty}} {{card.name}}</q-item-label>
        </q-item-section>
      </q-item>
        <!-- 
        -->
    </div>
  </q-list>
</template>

