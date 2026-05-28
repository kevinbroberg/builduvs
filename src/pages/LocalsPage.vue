<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import indexData from 'src/assets/locals-index.json'
import DeckCompareList from 'src/components/deck/DeckCompareList.vue'
import { cards as allCards } from 'src/js/card_provider.js'
import { getCardImage } from 'src/js/image_helper'
import { useDeckStore } from 'src/stores/deck'
import { storeToRefs } from 'pinia'

// Normalize apostrophes and other quote variants to plain straight apostrophe
function normName(name) {
  return name.toLowerCase().replace(/[‘’‚‛′]/g, "'")
}

const cardByName = new Map(allCards.map(c => [normName(c.name), c]))

function findCard(name) {
  if (!name) return null
  const n = normName(name)

  // 1. Exact match
  let card = cardByName.get(n)
  if (card) return card

  // 2. Flip card — try front side only (before " // ")
  if (n.includes(' // ')) {
    card = cardByName.get(n.split(' // ')[0].trim())
    if (card) return card
  }

  // 3. Year subtitle — "Name, YYYY ..." → try just "Name"
  const yearStripped = n.replace(/,\s*\d{4}.*/, '').trim()
  if (yearStripped !== n) {
    card = cardByName.get(yearStripped)
    if (card) return card
  }

  // 4. $ → s substitution ("Cardboard Crusader$" → "Cardboard Crusaders")
  if (n.includes('$')) {
    card = cardByName.get(n.replaceAll('$', 's'))
    if (card) return card
  }

  return null
}

const route  = useRoute()
const router = useRouter()

// ── Route params ──────────────────────────────────────────────────────────────

const eventId  = computed(() => route.params.event || null)
const playerId = computed(() => route.params.id ? parseInt(route.params.id) : null)

// ── Index data (always available) ─────────────────────────────────────────────

const { events, standings } = indexData

function getEvent(id) {
  return events.find(e => e.id === id) || null
}

function getStandings(eventId) {
  return standings[eventId] || []
}

function getStanding(eventId, standingNum) {
  return getStandings(eventId).find(s => s.standing === standingNum) || null
}

// ── Player data (lazy-loaded on first player view) ────────────────────────────

const playerData = ref(null)
const playerDataLoading = ref(false)

async function ensurePlayerData() {
  if (playerData.value || playerDataLoading.value) return
  playerDataLoading.value = true
  const mod = await import('src/assets/locals-players.json')
  playerData.value = mod.default ?? mod
  playerDataLoading.value = false
}

watch(playerId, (id) => { if (id) ensurePlayerData() }, { immediate: true })

function getPlayerCards(standingDbId) {
  return playerData.value?.cards?.[standingDbId] || []
}

function getPlayerMatches(standingDbId) {
  return playerData.value?.matches?.[standingDbId] || []
}

// ── Display helpers ───────────────────────────────────────────────────────────

function toTitleCase(str) {
  return str ? str.replace(/\b\w/g, c => c.toUpperCase()) : ''
}

// A person is identified by their standing + character name
function playerLabel(characterName, standing) {
  const rank = `Rank ${standing}`
  return characterName ? `${rank} ${toTitleCase(characterName)}` : rank
}

function formatDate(iso) {
  const [, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}`
}

function resultClass(result) {
  if (!result) return ''
  if (result.startsWith('W')) return 'result-win'
  if (result.startsWith('L')) return 'result-loss'
  if (result.startsWith('D')) return 'result-draw'
  return ''
}

// ── Opponent linking ──────────────────────────────────────────────────────────

function opponentRoute(opponentStanding) {
  if (!opponentStanding || !eventId.value) return null
  const s = getStanding(eventId.value, opponentStanding)
  return s?.deckName ? `/lists/${eventId.value}/${opponentStanding}` : null
}

// ── Computed views ─────────────────────────────────────────────────────────────

const LC_FORMATS = [
  { key: 'kaiju',  label: 'Reign of Kaiju' },
  { key: 'april',  label: 'April B&E' },
  { key: 'titan',  label: 'May B&E' },
]
const lcFormatKeys = new Set(LC_FORMATS.map(f => f.key))

const sortOrder = ref('players')

function sortEvents(evList, order = sortOrder.value) {
  return [...evList].sort((a, b) => {
    if (order === 'date') return b.date.localeCompare(a.date)
    const aHas = getStandings(a.id).some(s => s.deckName) ? 0 : 1
    const bHas = getStandings(b.id).some(s => s.deckName) ? 0 : 1
    if (aHas !== bHas) return aHas - bHas
    if (b.playerCount !== a.playerCount) return b.playerCount - a.playerCount
    return a.date.localeCompare(b.date)
  })
}

const lcEvents = events.filter(e => e.round !== 0)
const regionalEvents = events.filter(e => e.round === 0).sort((a, b) => a.date.localeCompare(b.date))

const regionalTabs = regionalEvents.map(e => ({
  key: e.id,
  label: `${e.location} · ${formatDate(e.date)}`,
  sortDate: e.date,
}))

const lcFormatSortDate = Object.fromEntries(
  LC_FORMATS.map(f => {
    const dates = lcEvents.filter(e => e.formatPeriod === f.key).map(e => e.date).sort()
    return [f.key, dates[0] ?? '9999']
  })
)

const FORMATS = [
  ...LC_FORMATS.map(f => ({ ...f, sortDate: lcFormatSortDate[f.key] })),
  ...regionalTabs,
].sort((a, b) => a.sortDate.localeCompare(b.sortDate))

const eventsByFormat = computed(() => ({
  ...Object.fromEntries(LC_FORMATS.map(f => [f.key, sortEvents(lcEvents.filter(e => e.formatPeriod === f.key))])),
  ...Object.fromEntries(regionalEvents.map(e => [e.id, [e]])),
}))

const tab = ref('kaiju')

const currentEvent     = computed(() => eventId.value ? getEvent(eventId.value) : null)
const currentStandings = computed(() => eventId.value ? getStandings(eventId.value) : [])
const currentStanding  = computed(() =>
  eventId.value && playerId.value ? getStanding(eventId.value, playerId.value) : null
)

const playerCards = computed(() => {
  if (!currentStanding.value) return {}
  const all = getPlayerCards(currentStanding.value.id)
  const out = {}
  for (const c of all) {
    if (!out[c.section]) out[c.section] = []
    out[c.section].push(c)
  }
  return out
})

const playerMatches = computed(() => {
  if (!currentStanding.value) return {}
  const all = getPlayerMatches(currentStanding.value.id)
  return {
    swiss:  all.filter(m => m.phase === 'swiss'),
    topcut: all.filter(m => m.phase === 'topcut'),
  }
})

function resolveCard(dc) {
  const found = findCard(dc.name)
  if (!found) console.warn(`[locals] unresolved card: "${dc.name}"`)
  return found ? { ...found, qty: dc.qty } : { name: dc.name, qty: dc.qty, asset: null, type: 'unknown' }
}

// ── Deck store integration ────────────────────────────────────────────────────

const deckStore = useDeckStore()
const { hasDeck } = storeToRefs(deckStore)

function buildThisDeck() {
  deckStore.loadFromCards({
    face: resolvedFace.value,
    deck: resolvedDeck.value,
    side: resolvedSide.value,
    name: currentStanding.value?.deckName || 'Locals Deck',
  })
}

function compareThisDeck() {
  deckStore.setPendingComparison({
    face: resolvedFace.value,
    deck: resolvedDeck.value,
    side: resolvedSide.value,
    name: currentStanding.value?.deckName || 'Locals Deck',
  })
  router.push('/compare')
}

const resolvedFace = computed(() => {
  const chars = playerCards.value.character
  if (!chars?.length) return null
  const found = findCard(chars[0].name)
  if (!found) console.warn(`[locals] unresolved face card: "${chars[0].name}"`)
  return found || null
})
const resolvedDeck = computed(() => (playerCards.value.main || []).map(resolveCard))
const resolvedSide = computed(() => (playerCards.value.sideboard || []).map(resolveCard))
</script>

<template>
  <q-page>

    <!-- ── Player detail (/locals/:event/:id) ─────────────────────────────── -->
    <template v-if="playerId">
      <q-toolbar class="bg-grey-2">
        <q-btn flat dense icon="arrow_back" @click="router.push(`/lists/${eventId}`)" />
        <q-toolbar-title class="text-body1">
          <strong>{{ playerLabel(currentStanding?.characterName, playerId) }}</strong>
          <span v-if="currentStanding?.deckName" class="text-caption text-grey-6 q-ml-sm">
            {{ currentStanding.deckName }}
          </span>
        </q-toolbar-title>
        <q-badge v-if="currentStanding?.swissRecord" color="grey-6"
          :label="currentStanding.swissRecord" class="q-mr-sm" />
        <template v-if="currentStanding?.deckName">
          <q-btn flat dense icon="style" size="sm" label="Build" class="q-ml-xs"
            :disable="playerDataLoading || !resolvedDeck.length"
            @click="buildThisDeck">
            <q-tooltip>Load this deck into the app</q-tooltip>
          </q-btn>
          <q-btn v-if="hasDeck" flat dense icon="difference" size="sm" label="Compare" class="q-ml-xs"
            :disable="playerDataLoading || !resolvedDeck.length"
            @click="compareThisDeck">
            <q-tooltip>Compare against your current deck</q-tooltip>
          </q-btn>
        </template>
      </q-toolbar>

      <div v-if="playerDataLoading" class="text-center q-pa-xl">
        <q-spinner size="3rem" color="primary" />
      </div>

      <div v-else-if="currentStanding" class="q-pa-md">

        <!-- Top row: match records left, face card right -->
        <div class="row q-col-gutter-md q-mb-md">
          <div class="col">

            <div v-if="playerMatches.swiss?.length" class="deck-section">
              <div class="deck-section__title">Swiss · {{ currentStanding.swissRecord }}</div>
              <table class="match-table">
                <tbody>
                  <tr v-for="m in playerMatches.swiss" :key="m.round">
                    <td class="col-rd">Rd {{ m.round }}</td>
                    <td :class="['col-result', resultClass(m.result)]">{{ m.result }}</td>
                    <td>
                      <router-link v-if="opponentRoute(m.opponentStanding)" :to="opponentRoute(m.opponentStanding)" class="opp-link">
                        {{ playerLabel(m.opponentCharacter, m.opponentStanding) }}
                      </router-link>
                      <span v-else>{{ playerLabel(m.opponentCharacter, m.opponentStanding) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="playerMatches.topcut?.length" class="deck-section">
              <div class="deck-section__title">Top Cut</div>
              <table class="match-table">
                <tbody>
                  <tr v-for="m in playerMatches.topcut" :key="m.round">
                    <td class="col-rd">{{ m.round }}</td>
                    <td :class="['col-result', resultClass(m.result)]">{{ m.result }}</td>
                    <td>
                      <router-link v-if="opponentRoute(m.opponentStanding)" :to="opponentRoute(m.opponentStanding)" class="opp-link">
                        {{ playerLabel(m.opponentCharacter, m.opponentStanding) }}
                      </router-link>
                      <span v-else>{{ playerLabel(m.opponentCharacter, m.opponentStanding) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>

          <div v-if="resolvedFace" class="col-auto">
            <img :src="getCardImage(resolvedFace.asset)" class="face-card-full" />
          </div>
        </div>

        <DeckCompareList
          v-if="resolvedDeck.length"
          :face="null"
          :deck-list="resolvedDeck"
          :side-list="resolvedSide"
        />

      </div>
    </template>

    <!-- ── Event detail (/locals/:event) ─────────────────────────────────── -->
    <template v-else-if="eventId">
      <q-toolbar class="bg-grey-2">
        <q-btn flat dense icon="arrow_back" @click="router.push('/lists')" />
        <q-toolbar-title class="text-body1">
          {{ currentEvent?.location }}
          <span class="text-caption text-grey-6 q-ml-sm">{{ currentEvent?.date }}</span>
        </q-toolbar-title>
        <q-badge color="grey-6" :label="`${currentEvent?.playerCount} players`" />
      </q-toolbar>

      <q-list separator>
        <q-item v-for="s in currentStandings" :key="s.standing"
          :class="{
            'row-winner': s.standing === 1,
            'row-top4':   s.standing > 1 && s.standing <= 4,
            'row-top8':   s.standing > 4 && s.standing <= 8,
          }"
          :clickable="!!s.deckName"
          @click="s.deckName && router.push(`/lists/${eventId}/${s.standing}`)">
          <q-item-section avatar style="min-width: 52px; position: relative">
            <q-avatar v-if="findCard(s.characterName)" square size="40px" class="standing-avatar">
              <img :src="getCardImage(findCard(s.characterName).asset)" class="card-thumb__img" />
            </q-avatar>
            <q-avatar v-else square size="40px" class="standing-avatar bg-grey-3" />
            <div class="standing-num text-caption">{{ s.standing }}</div>
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ playerLabel(s.characterName, s.standing) }}</q-item-label>
            <q-item-label v-if="s.swissRecord" caption>{{ s.swissRecord }}</q-item-label>
          </q-item-section>
          <q-item-section side v-if="s.deckName">
            <q-icon name="chevron_right" color="grey-5" />
          </q-item-section>
        </q-item>
      </q-list>
    </template>

    <!-- ── Event list (/locals) ──────────────────────────────────────────── -->
    <template v-else>
      <div class="row items-center bg-grey-2">
        <q-tabs v-model="tab" align="left" dense class="col text-grey-8">
          <q-tab v-for="f in FORMATS" :key="f.key" :name="f.key"
            :label="lcFormatKeys.has(f.key) ? `${f.label} · ${eventsByFormat[f.key].length} events` : f.label" />
        </q-tabs>
        <q-btn-toggle v-model="sortOrder" dense unelevated no-caps
          class="q-mr-sm"
          color="grey-3" text-color="grey-7" toggle-color="grey-7" toggle-text-color="white"
          :options="[
            { value: 'players', icon: 'group' },
            { value: 'date',    icon: 'calendar_today' },
          ]">
          <q-tooltip :delay="300">{{ sortOrder === 'players' ? 'Sorted by player count' : 'Sorted by date' }}</q-tooltip>
        </q-btn-toggle>
      </div>

      <q-list separator>
        <q-item v-for="ev in eventsByFormat[tab]" :key="ev.id"
          clickable v-ripple @click="router.push(`/lists/${ev.id}`)">
          <q-item-section avatar style="min-width: 56px">
            <div class="text-caption text-mono text-grey-7">{{ formatDate(ev.date) }}</div>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">{{ ev.location }}</q-item-label>
            <q-item-label caption>
              {{ ev.playerCount }} players
              <template v-if="ev.winnerCharacter">
                · <strong>{{ toTitleCase(ev.winnerCharacter) }}</strong>
              </template>
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="chevron_right" color="grey-5" />
          </q-item-section>
        </q-item>
      </q-list>
    </template>

  </q-page>
</template>

<style scoped>
.text-mono { font-family: monospace; }

.standing-avatar { overflow: hidden; }
.standing-avatar .card-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  transform: scale(1.4);
  transform-origin: top center;
}
.standing-num {
  position: absolute;
  bottom: 0;
  right: 0;
  background: rgba(0,0,0,0.55);
  color: #fff;
  padding: 0 3px;
  line-height: 1.4;
  border-radius: 2px 0 0 0;
}

.row-winner { background: rgba(255, 190, 0, 0.12); }
.row-top4   { background: rgba(0, 170, 90, 0.07); }
.row-top8   { background: rgba(0, 90, 200, 0.04); }

.deck-section { margin-bottom: 1.25rem; }
.deck-section__title {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #999;
  border-bottom: 1px solid rgba(0,0,0,0.1);
  padding-bottom: 3px;
  margin-bottom: 6px;
}

.match-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.match-table td { padding: 4px 6px; border-bottom: 1px solid rgba(0,0,0,0.05); }
.col-rd     { color: #999; width: 48px; }
.col-result { font-weight: 600; width: 64px; }
.result-win  { color: #00a550; }
.result-loss { color: #d32f2f; }
.result-draw { color: #f57c00; }

.opp-link { color: var(--q-primary); text-decoration: none; }
.opp-link:hover { text-decoration: underline; }

.face-card-full {
  display: block;
  width: 50vw;
  max-width: 360px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
</style>
