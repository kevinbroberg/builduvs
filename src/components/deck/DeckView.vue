<script setup> 
  import { ref, computed } from 'vue'
  import { useStore } from 'vuex';
  const store = useStore()
  const deck = computed(() => store.getters['deck/getDeckList'] )
  const mainChar = computed(() => store.getters['deck/getMain'])

  const increment = ev => store.commit('deck/increment', ev)
  const decrement = ev => store.commit('deck/decrement', ev)

  const simple = "Simple", type = "Types", symbol = "Symbols", control = "Control"
  const partitionOptions = [simple, type, symbol, control]
  const howPartition = ref(type)


  import Elements from 'components/cards/detail/Elements.vue'

  function arbitraryPartition(funk) {
    let contents = deck.value
    let parts = new Set([...contents.map(funk)])
    console.log("Partition results")
    console.log(parts)
    return [...parts].map(me => ({key: me, label: me, cards: contents.filter(c => funk(c) == me)})
    )
  }
  function matchSymbols(card) {
    let mainResources = mainChar.value.resources
    return card.resources.filter(resource => mainResources.includes(resource))
  }
  function symbolPartition() {
    return arbitraryPartition(card => matchSymbols(card).sort().toString())
  }
  function simplePartition() {
    return [{'key': 'all', 'label': 'Deck', 'cards': deck.value}]
  }
  /*
  // TODO this is the kind of thing unit tests are good for
  function symbolPartition() {
    // TODO use an Elements component for the label
    let groups = combinations(mainChar.value.resources)
    let parts = groups.map(g => {
      return { key: g, label: g ? g : "No Symbols", cards: []}
    } )
    deck.value.forEach( card => {
      // every resource in the partition must have a matching resource in at least one of the cards
      let index = parts.findIndex(part => part.key.every( resource => card.resources.some( cr => cr == resource)))
      // sentinel just in case - resource matching should always succeed on the empty list, though
      let use = index < 0 ? groups.length - 1 : index
      
      parts[use].cards.push(card)
    })
    return parts
  }
  */
  
  const partitions = computed(() => {
    switch(howPartition.value) {
        case type:
          return arbitraryPartition(card => card.type)
        case symbol:
          return symbolPartition()
        case control:
          return arbitraryPartition(card => card.control)
        case simple:
        default:
          return simplePartition()
    }
  })
</script>

<template>
  <q-select filled label="Partition" stack-label :options="partitionOptions" v-model="howPartition"/>

  <q-item-section avatar v-if="mainChar">
      <q-avatar>
      <!-- TODO zoom into just the card art here -->
      <img :src="require(`assets/images/card_images/${mainChar.asset}`)">
      </q-avatar>  
  </q-item-section>
  <q-item-section>
      <q-item-label lines="1">{{mainChar.name}} <Elements :card=mainChar /></q-item-label>
  </q-item-section>

  <q-list bordered>
    <div v-for="partition in partitions" :key="partition.key">
      <q-separator/>
      <!-- <q-item-label v-if="howPartition == symbol" header><Elements :card=partition.cards[0] /></q-item-label> -->
      <q-item-label header>{{partition.label}}</q-item-label> <!-- v-else -->
      <q-item v-for="card in partition.cards" :key="card.asset" no-wrap>
        <q-item-section avatar>
            <q-avatar>
              <!-- TODO zoom into just the card art here -->
              <!-- TODO onmouseover fade out and display an "add" icon -->
              <img :src="require(`assets/images/card_images/${card.asset}`)" @click="increment(card)" />
              
            </q-avatar>  
        </q-item-section>
        <q-item-section>
            <q-item-label lines="2"><q-btn flat round no-margin icon="remove" @click="decrement(card)"/> {{card.qty}} {{card.name}}</q-item-label>            
        </q-item-section>
      </q-item>
    </div>
  </q-list>
</template>

