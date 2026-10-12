import { defineStore } from 'pinia'
import { uvsId } from 'src/js/card_id'
import hydraNames from 'src/assets/hydra-names.json'

// Publishing decks to play.uvsgames.com, which runs on Hydra (tabletop.gg) since
// UVS Games left carde.io.
//
// Hydra's CORS doesn't admit builduvs.com, so the browser calls our own origin and
// we forward: public/_redirects in production, devServer.proxy in quasar.config.js
// for dev. Both target api-hydra.carde.io directly. The cf-api "hydraproxy" host
// the scrapers use answers GET/POST but 404s PATCH and DELETE.
const API = '/hydra-api'

const GAME_ID = 298
// "Standard", the deck builder's default format. Format only drives Hydra's
// legality report; it doesn't restrict what the import accepts.
const FORMAT_ID = 'b111581c-80fa-4828-b43c-fc013bdc4425'

export const hydraDeckUrl = id => `https://play.uvsgames.com/decks/${id}`

// Hydra's importer matches names case-insensitively and forgives straight vs curly
// apostrophes. Where its name differs beyond that (double-sided "Front // Back"
// pairs, "Arrows and Daggers", "Ibara Shiozaki (I)"…) hydra-names.json, built by
// scripts/build-hydra-names.mjs, has the spelling it wants.
export function hydraName(card) {
  return hydraNames.names[card.uvs_id ?? uvsId(card)] ?? card.name
}

// One "N Name" line per card, merging cards that land on the same Hydra name
// (both sides of a double-sided card, reprints).
function lines(cards) {
  const qty = new Map()
  for (const c of cards) {
    const name = hydraName(c)
    qty.set(name, (qty.get(name) || 0) + (c.qty || 1))
  }
  return [...qty].map(([name, n]) => `${n} ${name}`)
}

// Import only replaces sections whose header appears in the text, so all three are
// always written: an emptied sideboard must clear the old one on re-publish.
export function deckText({ face, getDeckList, getSideList }) {
  return [
    'Character', ...(face ? lines([{ ...face, qty: 1 }]) : []), '',
    'Main Deck', ...lines(getDeckList), '',
    'Sideboard', ...lines(getSideList),
  ].join('\n')
}

const NOT_FOUND = /not found/i
// A character the importer can't resolve aborts the whole parse with only a
// top-level "Card 'X' not found for UniVersus" error.
const ABORTED_ON = /Card '(.+)' not found/

export const useHydraStore = defineStore('hydra', {
  state: () => ({
    token: localStorage.getItem('hydra_token') ?? null,
    // Display name of the account the token belongs to.
    user: null,
  }),

  getters: {
    hasToken: (state) => !!state.token,
  },

  actions: {
    setToken(token) {
      // Accept the header value as copied ("Token abc…") or just the key.
      this.token = token.trim().replace(/^(Token|Bearer)\s+/i, '')
      localStorage.setItem('hydra_token', this.token)
    },
    clearToken() {
      this.token = null
      this.user = null
      localStorage.removeItem('hydra_token')
    },

    async request(method, path, body) {
      const res = await fetch(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Token ${this.token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (res.status === 401 || res.status === 403) {
        this.clearToken()
        throw new Error('play.uvsgames.com rejected the token. It may have expired; paste a fresh one.')
      }
      const text = await res.text()
      let json = null
      try { json = text ? JSON.parse(text) : null } catch { /* not JSON */ }
      if (!res.ok) {
        const err = new Error(json?.message || json?.error || `${method} ${path} failed (${res.status})`)
        err.status = res.status
        throw err
      }
      return json
    },

    // Confirms the token and learns whose it is. False when Hydra rejects it.
    async validateToken() {
      try {
        const me = await this.request('GET', '/users/self/')
        this.user = me.best_identifier || me.username
        return true
      } catch {
        return false
      }
    },

    // Dry run through Hydra's validator: which names it can't resolve, plus its
    // own legality findings. Saves nothing.
    async check(text) {
      const unmatched = []
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await this.request('POST', '/deckbuilder/decks/validate-text/',
          { game: GAME_ID, format: FORMAT_ID, full_text: text })
        const aborted = (res.errors || []).map(e => ABORTED_ON.exec(e)?.[1]).find(Boolean)
        if (aborted) {
          // Drop the offending line and look again, so one bad character doesn't
          // hide everything else.
          unmatched.push(aborted)
          text = text.split('\n').filter(l => l.replace(/^\d+\s+/, '') !== aborted).join('\n')
          continue
        }
        for (const [name, errs] of Object.entries(res.card_errors || {})) {
          if (errs.some(e => NOT_FOUND.test(e))) unmatched.push(name)
        }
        const legality = (res.errors || []).filter(e => !NOT_FOUND.test(e))
        return { text, unmatched, legality, isLegal: !!res.is_legal }
      }
      throw new Error('Hydra could not parse this deck.')
    },

    // Creates (or, given an id it still has, overwrites) a private deck on
    // play.uvsgames.com. Returns the check results and the deck id.
    async publish(name, deckStore, existingId = null) {
      const result = await this.check(deckText(deckStore))

      let id = existingId
      if (id) {
        try {
          await this.request('PATCH', `/deckbuilder/decks/${id}/`, { name })
        } catch (e) {
          if (e.status !== 404) throw e
          id = null // deleted on the site since; make a fresh one
        }
      }
      if (!id) {
        const created = await this.request('POST', '/deckbuilder/decks/create/',
          { game: GAME_ID, format: FORMAT_ID, name })
        id = created.id
      }
      await this.request('POST', `/deckbuilder/decks/${id}/import-from-text/`, { full_text: result.text })

      return { ...result, deckId: id, updated: id === existingId }
    },
  },
})
