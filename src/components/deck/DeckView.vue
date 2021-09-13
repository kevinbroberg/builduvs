<script setup> 
  import { ref, computed } from 'vue'
  import { useStore } from 'vuex';
  const store = useStore()
  const deck = computed(() => store.getters['deck/getDeckList'] )
  const mainChar = computed(() => store.getters['deck/getMain'])
  const simple = "Simple", type = "Types", symbol = "Symbols"
  const partitionOptions = [simple, type, symbol]
  const howPartition = ref(type)

  function combinations(list) {
    if (list.length == 1) {
      return [list, []]
    }
    let result = [[...list]]
    
    function nless1(_, idx, original) {
      return [...original.slice(0, idx), ...original.slice(idx + 1)]
    }
    result.push(...list.map(nless1)) // length 2 sublists
    list.forEach(e => result.push([e])) // length 1
    result.push([[]]) // length 0
    return result
  }

  import Elements from 'components/cards/detail/Elements.vue'

  function simplePartition() {
    return [{'key': 'all', 'label': 'Deck', 'cards': deck.value}]
  }
  // TODO this is the kind of thing unit tests are good for
  function symbolPartition() {
    // TODO use an Elements component for the label
    let groups = combinations(mainChar.value.resources)
    console.log(groups)

    let parts = groups.map(g => {
      return { key: g, label: g ? g : "No Symbols", cards: []}
    } )
    console.log(parts)
    console.log(parts)
    deck.value.forEach( card => {
      // every resource in the partition must have a matching resource in at least one of the cards
      let index = parts.findIndex(part => part.key.every( resource => card.resources.some( cr => cr == resource)))
      // sentinel just in case - resource matching should always succeed on the empty list, though
      let use = index < 0 ? groups.length - 1 : index
      
      parts[use].cards.push(card)
    })
    return parts
  }
  function typePartition() {
    let types = new Set([...deck.value.map(card => card.type)])
    return [...types].map(me => {
      return {'key': me, 'label': me, 'cards': deck.value.filter(card => card.type === me)}
    })
  }
  
  const partitions = computed(() => {
    switch(howPartition.value) {
        case type:
          return typePartition()
        case symbol:
          return symbolPartition()
        case simple:
        default:
          return simplePartition()
    }
  })
</script>

<template>
  <q-select :options="partitionOptions" v-model="howPartition"/>

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
    </div>
  </q-list>
</template>

