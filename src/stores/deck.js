import { defineStore } from 'pinia'

export const useDeckStore = defineStore('deck', {
  state: () => ({
    deck: {},
    side: {},
    face: undefined,
  }),

  getters: {
    hasDeck: (state) => Object.keys(state.deck).length > 0,
    hasSide: (state) => Object.keys(state.side).length > 0,
    getDeckList: (state) => Object.keys(state.deck).map(k => state.deck[k]),
    getSideList: (state) => Object.keys(state.side).map(k => state.side[k]),
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
        if (this.face === card) this.face = undefined
      }
    },
    decrementSide(card) {
      let qtyObj = this.side[card.asset] || { qty: 1 }
      let count = qtyObj.qty - 1
      if (count > 0) {
        this.side[card.asset] = { ...card, qty: count }
      } else {
        delete this.side[card.asset]
        if (this.face === card) this.face = undefined
      }
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
      this.face = undefined
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
  },
})
