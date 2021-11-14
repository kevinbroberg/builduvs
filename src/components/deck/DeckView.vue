<script setup> 
  import { ref, computed } from 'vue'
  import { useStore } from 'vuex'
  import { useQuasar, copyToClipboard } from 'quasar'

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

  const simple = "Simple", type = "Types", symbol = "Symbols", difficulty = "Difficulty", control = "Control", block = 'Block'
  const partitionOptions = [simple, type, symbol, difficulty, control, block]
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

  function count(stack) {
    return stack.reduce((total, me) => total + me.qty, 0)
  }
  function arbitraryPartition(funk) {
    let contents = store.getters['deck/getDeckList'] // TODO, sometime, sort this
    // unique values for applying the function
    let parts = new Set([...contents.map(funk)])
    
    // coerce the Set back into a List
    return [...parts].map(me => {
      let part = contents.filter(c => funk(c) == me)
      let qty = count(part)
      return {key: me, label: `${me}: ${qty}`, cards: part} // TODO decouple algorithm from this display logic
    })
  }

  function matchSymbols(card) {
    let mainResources = face.value?.resources
    return card.resources.filter(resource => mainResources?.includes(resource))
  }
  
  const partitions = computed(() => {
    let main
    switch(howPartition.value) {
        case type:
          main = arbitraryPartition(card => card.type)
          break
        case block:
          main = arbitraryPartition(card => card.block_zone)
          break
        case symbol:
          main = arbitraryPartition(card => matchSymbols(card).sort().toString())
          break
        case control:
          main = arbitraryPartition(card => card.control)
          break
        case difficulty:
          main = arbitraryPartition(card => card.difficulty)
          break
        case simple:
        default:
          main = arbitraryPartition(c => "All")
    }
    const sideContent = store.getters['deck/getSideList']
    if (sideContent?.length > 0) {
      let sidePart = {key: "sideboard", label: `Sideboard: ${count(sideContent)}`, cards: sideContent}
      main.push(sidePart)
    }
    return main
  })

  function deck2clipboard() {
    let main = partitions.value.filter(part => part.key != "sideboard")
    const deckList = main.map(p => p.cards).flat() // use displayed ordering of cards
    let name = face.value?.name // mainchar may be undefined
    let myFace = name ? [{ name: name, qty: 1 }] : [] // if it's not, there is 1 copy in your deck
    let deck = [...myFace, ...deckList].map(c => `${c.qty} ${c.name}`)
    
    let side = store.getters['deck/hasSide'] ? ['sideboard', ...store.getters['deck/getSideList'].map(c => `${c.qty} ${c.name}`)] : []
    // maybe TODO sometime: accumulate additional copies of main char into the 1st quantity, vs 1 Amy... 3 Amy that will happen now
    // a possible method: simply increment() face before exporting? or have a general dedupe method, and prepend face to the list before dedupe
    // navigator.clipboard.writeText([...deck, ...side ].join('\n'))
    copyToClipboard([...deck, ...side ].join('\n')).catch(() => console.log("TODO alert the user that their clipboard failed"))
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
      <q-item v-for="card in partition.cards" :key="card.asset" no-wrap dense :class="`card-list-${card.type}`">
        <q-item-section avatar v-ripple>
            <q-avatar square>
              <!-- TODO zoom into just the card art here -->
              <img
                :src="require(`assets/images/card_images/${card.asset}`)" @click="increment(card)" 
              />
              
            </q-avatar>  
        </q-item-section>
        <q-item-section>
            <q-item-label lines="2">
              <q-btn v-ripple flat round no-margin icon="remove" 
                @click="decrement(card)"/>
              {{card.qty}} {{card.name}}
            </q-item-label>            
        </q-item-section>
      </q-item>
    </div>
  </q-list>
</template>

<style>
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
