<script setup> 
  import { ref, computed } from 'vue'
  import { useStore } from 'vuex'
  import { useQuasar } from 'quasar'

  const store = useStore()
  const deck = computed(() => store.getters['deck/getDeckList'] )
  const face = computed(() => store.getters['deck/getFace'])

  const increment = ev => store.commit('deck/increment', ev)
  const decrement = ev => store.commit('deck/decrement', ev)

  const trash = ev => store.commit('deck/nuke')
  const clearFace = ev => store.commit('deck/setFace', undefined) // TODO make this a real mutation?

  const $q = useQuasar()

  import DeckLoaderDialog from 'components/deck/DeckLoaderDialog.vue'
  function deckLoadDialog() {
    $q.dialog({
      component: DeckLoaderDialog,
    })
    // .onOk(() => {
    //   console.log('OK')
    // }).onCancel(() => {
    //   console.log('Cancel')
    // }).onDismiss(() => {
    //   console.log('Called on OK or Cancel')
    // })
  }

  const simple = "Simple", type = "Types", symbol = "Symbols", difficulty = "Difficulty", control = "Control"
  const partitionOptions = [simple, type, symbol, difficulty, control]
  const howPartition = ref(type)


  // const sorts = ['Difficulty', 'Control', 'Block_Modifier', 'Speed', 'Damage', 'Name'].map(f => ({ label: f.toLowerCase(), fun: card => card[f]}))
  // const sortField = ref('')
  // function compare(a, b) {
  //   console.log('hi from compare')
  //   if (sortField.value) {
  //     return a[sortField.value] - b[sortField.value]
  //   } else {
  //     return 1 // do nothing
  //   }
  // }

  // const sortedDeck = computed(() => [...deck.value].sort(compare))
  import Elements from 'components/cards/detail/Elements.vue'

  function arbitraryPartition(funk) {
    let contents = deck.value // sortedDeck.value
    // unique values for applying the function
    let parts = new Set([...contents.map(funk)])
    
    // coerce the Set back into a List
    return [...parts].map(me => {
      let part = contents.filter(c => funk(c) == me)
      let qty = part.reduce((total, me) => total + me.qty, 0)
      return {key: me, label: `${qty} ${me}`, cards: part}
    })
  }
  function matchSymbols(card) {
    let mainResources = face.value.resources
    return card.resources.filter(resource => mainResources.includes(resource))
  }
  function symbolPartition() {
    return arbitraryPartition(card => matchSymbols(card).sort().toString())
  }
  function simplePartition() {
    return arbitraryPartition(c => "All")
  }
  
  const partitions = computed(() => {
    switch(howPartition.value) {
        case type:
          return arbitraryPartition(card => card.type)
        case symbol:
          return symbolPartition()
        case control:
          return arbitraryPartition(card => card.control)
        case difficulty:
          return arbitraryPartition(card => card.difficulty)
        case simple:
        default:
          return simplePartition()
    }
  })

/*
export function getDeckText(state) {
    let name = getFace(state)?.name // mainchar may be undefined
    let face = name ? [{ name: name, qty: 1 }] : [] // if it's not, there is 1 copy in your deck
    let deck = [...face, ...getDeckList(state)].map(c => `${c.qty} ${c.name}`)
    
    let side = hasSide(state) ? ['sideboard', ...getSideList(state).map(c => `${c.qty} ${c.name}`)] : []
    // maybe TODO sometime: accumulate additional copies of main char into the 1st quantity, vs 1 Amy... 3 Amy that will happen now
    // a possible method: simply increment() face before exporting? or have a general dedupe method, and prepend face to the list before dedupe
    return [...deck, ...side ].join('\n')
}
*/
  function deck2clipboard() {
    const deckList = partitions.value.map(p => p.cards).flat()
    let name = face.value?.name // mainchar may be undefined
    let myFace = name ? [{ name: name, qty: 1 }] : [] // if it's not, there is 1 copy in your deck
    let deck = [...myFace, ...deckList].map(c => `${c.qty} ${c.name}`)
    
    let side = store.getters['deck/hasSide'] ? ['sideboard', ...store.getters['deck/getSideList'](state).map(c => `${c.qty} ${c.name}`)] : []
    // maybe TODO sometime: accumulate additional copies of main char into the 1st quantity, vs 1 Amy... 3 Amy that will happen now
    // a possible method: simply increment() face before exporting? or have a general dedupe method, and prepend face to the list before dedupe
    navigator.clipboard.writeText([...deck, ...side ].join('\n'))
  }
</script>

<template>
  <q-btn-group push>
    
      <q-btn push stack dense round icon="file_upload" @click="deckLoadDialog">
        <q-tooltip>Load a deck from file or with text input</q-tooltip>
      </q-btn>
      <!-- <q-btn-dropdown menu-self="bottom middle" push stack auto-close 
        label="Sort" icon="sort">
        <q-item v-for="sort in sorts" v-bind:key="sort.label" clickable @click="sortField = sort">
          <q-item-label standout v-if='sortField == sort'>{{sort.label}}</q-item-label>
          <q-item-label v-else>{{sort.label}}</q-item-label>
        </q-item>
      </q-btn-dropdown> -->
      
      <q-btn-dropdown menu-self="bottom middle" push stack auto-close
        label="Partition" icon="group_work">
        <q-item v-for="partOpt in partitionOptions" v-bind:key="partOpt" clickable @click="howPartition = partOpt" :active="howPartition === partOpt" active-class="bg-orange-13">
          <q-item-label>{{partOpt}}</q-item-label>
        </q-item>
      </q-btn-dropdown>
      <q-btn push label="Copy" icon="content_copy" @click="deck2clipboard" >
        <q-tooltip>Copies your deck to clipboard</q-tooltip>
      </q-btn>
      <q-btn push label="Wipe" icon="delete" @click="trash" />
  </q-btn-group>

  <q-item-section avatar v-if="face">
      <q-avatar>
      <!-- TODO zoom into just the card art here -->
      <img :src="require(`assets/images/card_images/${face.asset}`)">
      </q-avatar>  
      <q-btn icon="clear" @click="clearFace" />
  </q-item-section>
  <q-item-section>
      <q-item-label lines="1" v-if="face">{{face.name}} <Elements :resources="face.resources" /></q-item-label>
  </q-item-section>

  <q-list bordered>
    <div v-for="partition in partitions" :key="partition.key">
      <q-separator/>
      <!-- <q-item-label v-if="howPartition == symbol" header><Elements :card=partition.cards[0].resources /></q-item-label> -->
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

