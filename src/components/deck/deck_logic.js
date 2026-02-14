  import { ref, computed } from 'vue'
  import { copyToClipboard } from 'quasar'
  import { useDeckStore } from 'src/stores/deck'

  const store = useDeckStore()

  export const deck = computed(() => store.getDeckList)
  export const face = computed(() => store.face)

  export const increment = ev => store.increment(ev)
  export const decrement = ev => store.decrement(ev)

  export const trash = ev => store.nuke()
  export const clearFace = ev => store.setFace(undefined)


  const simple = "Simple", type = "Types", symbol = "Symbols", difficulty = "Difficulty", control = "Control", block = 'Block'
  export const partitionOptions = [simple, type, symbol, difficulty, control, block]
  export const howPartition = ref(type)


  export const sorts = ['Difficulty', 'Control', 'Block_Modifier', 'Speed', 'Damage', 'Name'].map(f => ({ label: f.toLowerCase(), fun: card => card[f]}))
  export const sortField = ref('')
  export function compare(a, b) {
    if (sortField.value) {
      let av = a[sortField.value], bv = b[sortField.value]
      return av > bv ? 1 : bv > av ? -1 : 0
    } else {
      return 0 // do nothing
    }
  }

  export const sortedDeck = computed(() => [...deck.value].sort(compare))

  function count(stack) {
    return stack.reduce((total, me) => total + me.qty, 0)
  }
  function arbitraryPartition(funk) {
    let contents = store.getDeckList
    const safeFunk = c => {
      let value = funk(c)
      return value == undefined ? "None" : value
    }
    // unique values for applying the function
    let parts = new Set([...contents.map(safeFunk)])

    // coerce the Set back into a List
    return [...parts].map(me => {
      let part = contents.filter(c => safeFunk(c) == me)
      let qty = count(part)
      return {key: me, label: `${me}: ${qty}`, cards: part} // TODO decouple algorithm from this display logic
    })
  }

  export function matchSymbols(card) {
    let mainResources = face.value?.resources
    return card.resources.filter(resource => mainResources?.includes(resource))
  }

  export const SIDEKEY = "sideboard"

  export const partitions = computed(() => {
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
    const sideContent = store.getSideList
    if (sideContent?.length > 0) {
      let sidePart = {key: SIDEKEY, label: `Sideboard: ${count(sideContent)}`, cards: sideContent.map(c => ({...c, type: 'sideboard'}))}
      main.push(sidePart)
    }
    return main
  })

  export function deck2clipboard() {
    let main = partitions.value.filter(part => part.key != SIDEKEY)
    const deckList = main.map(p => p.cards).flat() // use displayed ordering of cards
    let name = face.value?.name // mainchar may be undefined
    let myFace = name ? [{ name: name, qty: 1 }] : [] // if it's not, there is 1 copy in your deck
    let deck = [...myFace, ...deckList].map(c => `${c.qty} ${c.name}`)

    let side = store.hasSide ? ['sideboard', ...store.getSideList.map(c => `${c.qty} ${c.name}`)] : []
    // maybe TODO sometime: accumulate additional copies of main char into the 1st quantity, vs 1 Amy... 3 Amy that will happen now
    // a possible method: simply increment() face before exporting? or have a general dedupe method, and prepend face to the list before dedupe
    // navigator.clipboard.writeText([...deck, ...side ].join('\n'))
    copyToClipboard([...deck, ...side ].join('\n')).catch(() => console.log("TODO alert the user that their clipboard failed"))
  }
