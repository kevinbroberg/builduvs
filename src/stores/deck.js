import { defineStore } from 'pinia'

export const useDeckStore = defineStore('deck', {
  state: () => ({
    deck: {},
    side: {},
    // Cards under consideration. Deliberately outside deck/side: exports and the
    // deck-symbol summary read only those, so the maybeboard never leaks into them.
    // (New keys here need a backfill in stores/index.js; see BUVS-0005 there.)
    maybe: {},
    // Must default to null, not undefined: JSON.stringify drops undefined keys,
    // so an undefined face would vanish from persisted state and Pinia would
    // hydrate the store without a `face` ref — after which setting a character
    // never persists (BUVS-0005). null round-trips through JSON and keeps the ref.
    face: null,

    // Current deck metadata
    currentDeckId: null,
    currentDeckName: 'Untitled Deck',
    currentDeckFormat: null,
    currentDeckModified: null,
    currentCardeioId: null,
    // The play.uvsgames.com (Hydra) deck this one was last published to, so a
    // re-publish overwrites it rather than making a copy.
    currentHydraId: null,

    // Saved decks library: { [id]: { id, name, format, modified, deck, side, maybe, face } }
    savedDecks: {},

    // Transient handoff for the Compare page
    pendingComparison: null,
  }),

  getters: {
    hasDeck: (state) => Object.keys(state.deck).length > 0 || !!state.face,
    hasSide: (state) => Object.keys(state.side).length > 0,
    getDeckList: (state) => Object.keys(state.deck).map(k => state.deck[k]),
    getSideList: (state) => Object.keys(state.side).map(k => state.side[k]),
    hasMaybe: (state) => Object.keys(state.maybe).length > 0,
    getMaybeList: (state) => Object.values(state.maybe),
    getFace: (state) => state.face,
    quantity: (state) => (asset) => {
      let card = state.deck[asset]
      let qty = card ? card.qty : 0
      if (state.face?.asset === asset) qty += 1
      return qty
    },
    sideQuantity: (state) => (asset) => {
      let card = state.side[asset]
      return card ? card.qty : 0
    },
    maybeQuantity: (state) => (asset) => state.maybe[asset]?.qty || 0,
    savedDecksList: (state) => {
      return Object.values(state.savedDecks || {})
        .sort((a, b) => new Date(b.modified) - new Date(a.modified))
    },
  },

  actions: {
    increment(card) {
      if (card.type === 'character' && !this.face) {
        this.setFace(card)
        return
      }
      let count = this.deck[card.asset]?.qty || 0
      let max = card.limit || 4
      count = count >= max ? max : count + 1
      this.deck[card.asset] = { ...card, qty: count }
    },
    incrementSide(card) {
      let count = this.side[card.asset]?.qty || 0
      let max = card.limit || 4
      count = count >= max ? max : count + 1
      this.side[card.asset] = { ...card, qty: count }
    },
    decrement(card) {
      let qtyObj = this.deck[card.asset] || { qty: 1 }
      let count = qtyObj.qty - 1
      if (count > 0) {
        this.deck[card.asset] = { ...card, qty: count }
      } else {
        delete this.deck[card.asset]
        if (this.face === card) this.face = null
      }
    },
    decrementSide(card) {
      let qtyObj = this.side[card.asset] || { qty: 1 }
      let count = qtyObj.qty - 1
      if (count > 0) {
        this.side[card.asset] = { ...card, qty: count }
      } else {
        delete this.side[card.asset]
        if (this.face === card) this.face = null
      }
    },
    incrementMaybe(card) {
      let count = this.maybe[card.asset]?.qty || 0
      let max = card.limit || 4
      this.maybe[card.asset] = { ...card, qty: Math.min(count + 1, max) }
    },
    decrementMaybe(card) {
      let count = (this.maybe[card.asset]?.qty || 1) - 1
      if (count > 0) this.maybe[card.asset] = { ...card, qty: count }
      else delete this.maybe[card.asset]
    },
    // Moves one copy between boards: 'main' | 'side' | 'maybe'.
    moveCard(card, from, to) {
      if (from === to) return
      const { qty, ...bare } = card
      const remove = { main: this.decrement, side: this.decrementSide, maybe: this.decrementMaybe }[from]
      const add = { main: this.increment, side: this.incrementSide, maybe: this.incrementMaybe }[to]
      remove.call(this, card)
      add.call(this, bare)
    },
    setFace(card) {
      this.face = card
    },
    remove(card) {
      delete this.deck[card.asset]
    },
    nuke() {
      this.deck = {}
      this.side = {}
      this.maybe = {}
      this.face = null
    },
    setQty(card, qty) {
      let max = card.limit || 4
      let min = 0
      qty = qty > max ? max : qty
      qty = qty < min ? min : qty
      this.deck[card.asset] = { ...card, qty }
    },
    send2Board(card) {
      this.decrement(card)
      this.incrementSide(card)
    },
    send2Main(card) {
      this.decrementSide(card)
      this.increment(card)
    },

    loadFromCards({ face, deck, side, maybe, name }) {
      this.nuke()
      if (face) this.face = { ...face }
      for (const card of (deck || [])) {
        if (card.asset) this.deck[card.asset] = { ...card }
      }
      for (const card of (side || [])) {
        if (card.asset) this.side[card.asset] = { ...card }
      }
      for (const card of (maybe || [])) {
        if (card.asset) this.maybe[card.asset] = { ...card }
      }
      this.currentDeckName = name || 'Untitled Deck'
      this.currentDeckId = null
      this.currentDeckFormat = null
      this.currentDeckModified = new Date().toISOString()
      this.currentCardeioId = null
      this.currentHydraId = null
    },

    setPendingComparison(data) {
      this.pendingComparison = data
    },

    clearPendingComparison() {
      this.pendingComparison = null
    },

    saveDeck(name, format) {
      const id = this.currentDeckId || `deck_${Date.now()}`
      const deckName = name || this.currentDeckName || 'Untitled Deck'
      const deckFormat = format !== undefined ? format : this.currentDeckFormat
      const now = new Date().toISOString()

      if (!this.savedDecks) this.savedDecks = {}
      this.savedDecks[id] = {
        id,
        name: deckName,
        format: deckFormat,
        modified: now,
        deck: JSON.parse(JSON.stringify(this.deck)),
        side: JSON.parse(JSON.stringify(this.side)),
        maybe: JSON.parse(JSON.stringify(this.maybe)),
        face: this.face ? JSON.parse(JSON.stringify(this.face)) : null,
        cardeioId: this.currentCardeioId ?? null,
        hydraId: this.currentHydraId ?? null,
      }

      this.currentDeckId = id
      this.currentDeckName = deckName
      this.currentDeckFormat = deckFormat
      this.currentDeckModified = now
    },

    loadDeck(deckId) {
      const saved = this.savedDecks[deckId]
      if (!saved) return

      this.deck = JSON.parse(JSON.stringify(saved.deck))
      this.side = JSON.parse(JSON.stringify(saved.side))
      this.maybe = JSON.parse(JSON.stringify(saved.maybe ?? {}))
      this.face = saved.face ? JSON.parse(JSON.stringify(saved.face)) : null

      this.currentDeckId = saved.id
      this.currentDeckName = saved.name
      this.currentDeckFormat = saved.format
      this.currentDeckModified = saved.modified
      this.currentCardeioId = saved.cardeioId ?? null
      this.currentHydraId = saved.hydraId ?? null
    },

    deleteDeck(deckId) {
      delete this.savedDecks[deckId]
      if (this.currentDeckId === deckId) {
        this.currentDeckId = null
        this.currentDeckName = 'Untitled Deck'
        this.currentDeckFormat = null
        this.currentDeckModified = null
      }
    },

    newDeck() {
      this.nuke()
      this.currentDeckId = null
      this.currentDeckName = 'Untitled Deck'
      this.currentDeckFormat = null
      this.currentDeckModified = null
      this.currentCardeioId = null
      this.currentHydraId = null
    },
  },
})
