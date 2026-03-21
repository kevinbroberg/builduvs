import { defineStore } from 'pinia'

const API = 'https://play-api.carde.io/v1'

const SECTION_CHARACTER = '773a74a1e7536ea7be98d510'
const SECTION_MAIN      = '773a74a1e7536ea7be98d511'
const SECTION_SIDE      = '773a74a1e7536ea7be98d512'

export const useCardeioStore = defineStore('cardeio', {
  state: () => ({
    token: localStorage.getItem('cardeio_token') ?? null,
  }),

  getters: {
    hasToken: (state) => !!state.token,
  },

  actions: {
    setToken(token) {
      this.token = token
      localStorage.setItem('cardeio_token', token)
    },
    clearToken() {
      this.token = null
      localStorage.removeItem('cardeio_token')
    },

    async validateToken() {
      // Quick check: fetch any deck to confirm token is valid
      const res = await fetch(`${API}/decks/670ef40a496360e53751cfa1`, {
        headers: { authorization: `Bearer ${this.token}` },
      })
      return res.ok
    },

    // Returns { sections, unmatched }
    // unmatched: [{ name, count, sectionId }]
    buildSections(deckStore, fixes = {}) {
      // fixes: { cardName -> cardeioId }
      const unmatched = []

      const charId = deckStore.face ? (deckStore.face.cardeio_id ?? fixes[deckStore.face.name] ?? null) : null
      if (deckStore.face && !charId) unmatched.push({ name: deckStore.face.name, count: 1, sectionId: SECTION_CHARACTER })

      const mainCards = []
      for (const card of Object.values(deckStore.deck)) {
        const id = card.cardeio_id ?? fixes[card.name] ?? null
        if (id) {
          mainCards.push({ cardId: id, count: card.qty })
        } else {
          unmatched.push({ name: card.name, count: card.qty, sectionId: SECTION_MAIN })
        }
      }

      const sideCards = []
      for (const card of Object.values(deckStore.side)) {
        const id = card.cardeio_id ?? fixes[card.name] ?? null
        if (id) {
          sideCards.push({ cardId: id, count: card.qty })
        } else {
          unmatched.push({ name: card.name, count: card.qty, sectionId: SECTION_SIDE })
        }
      }

      const sections = [
        { deckSectionId: SECTION_CHARACTER, cards: charId ? [{ cardId: charId, count: 1 }] : [] },
        { deckSectionId: SECTION_MAIN,      cards: mainCards },
        { deckSectionId: SECTION_SIDE,      cards: sideCards },
      ]

      return { sections, unmatched }
    },

    async pushDeck(deckId, deckStore, fixes = {}) {
      const { sections, unmatched } = this.buildSections(deckStore, fixes)

      const res = await fetch(`${API}/decks/${deckId}`, {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${this.token}`,
          'content-type': 'application/json',
          origin: 'https://play.uvsgames.com',
        },
        body: JSON.stringify({ sections }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Push failed (${res.status}): ${text}`)
      }

      return { unmatched }
    },
  },
})
