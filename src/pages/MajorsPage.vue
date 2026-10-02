<script setup>
import { ref, shallowRef, computed, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { copyToClipboard } from 'quasar'
import { setPageTitle } from 'src/js/page_title'
import indexData from 'src/assets/majors-index.json'
import DeckBody from 'src/components/deck/DeckBody.vue'
import DeckStage from 'src/components/deck/DeckStage.vue'
import { getCardImage } from 'src/js/image_helper'
import ResourceSymbol from 'src/components/cards/detail/ResourceSymbol.vue'
import { useDeckStore } from 'src/stores/deck'
import { storeToRefs } from 'pinia'
import { downloadTTSJson } from 'src/js/tts_export'
import { createCardResolver, normName } from 'src/js/decklist_cards'
import { TIERS, tierInfo, seasonLabel, compareEvents } from 'src/js/major_naming'
import { createDeckData } from 'src/js/deck_data'

// Majors reach back to 2024, when most of the field was still legal but has
// since rotated out, so resolve against every printing rather than the
// standard-only pool /lists uses. See src/js/decklist_cards.js.
const { findCard, resolveCard } = createCardResolver({ standardOnly: false })

const route  = useRoute()
const router = useRouter()

// ── Deck display view (tiles vs text list) ────────────────────────────────────
// Mirrors /lists: ?view=tiles|list and ?cols=N seed the opening view without
// overwriting the visitor's saved default.
const qView = route.query.view
const qCols = Number(route.query.cols)

const majorsView = ref(
  qView === 'tiles' || qView === 'list'
    ? qView
    : (localStorage.getItem('listsView') || 'tiles')
)
function setMajorsView(v) {
  majorsView.value = v
  localStorage.setItem('listsView', v)
}
const majorsColumns = ref(
  Number.isFinite(qCols) && qCols >= 3 && qCols <= 12
    ? qCols
    : Number(localStorage.getItem('listsColumns') || 6)
)
function setMajorsColumns(n) {
  majorsColumns.value = n
  localStorage.setItem('listsColumns', String(n))
}
watch(majorsColumns, setMajorsColumns)

const eventId  = computed(() => route.params.event || null)
const playerId = computed(() => route.params.id ? parseInt(route.params.id) : null)

// ── Index data ────────────────────────────────────────────────────────────────

const { events, standings } = indexData

const getEvent     = id => events.find(e => e.id === id) || null
const getStandings = id => standings[id] || []
const getStanding  = (id, n) => getStandings(id).find(s => s.standing === n) || null

// ── Player data (lazy-loaded on first deck view) ──────────────────────────────

// Deck rows come from one static JSON per SEASON under public/deck-data/majors/,
// fetched when a deck is opened. Previously this was a single bundled import
// that Vite inlined into a 7.7MB JS chunk — see src/js/deck_data.js.
const deckData = createDeckData({ index: indexData, basePath: '/deck-data/majors' })

// shallowRef, not ref: the shard is a large immutable blob (thousands of deck
// rows; the biggest majors season is ~4.8MB). A deep ref would have Vue build a
// reactive proxy for every object in it, which costs real time on load and buys
// nothing — the data is replaced wholesale, never mutated in place.
const playerData = shallowRef(null)
const playerDataLoading = ref(false)
let loadedSeason = null

const getPlayerCards   = id => deckData.cardsFor(playerData.value, id)
const getPlayerMatches = id => deckData.matchesFor(playerData.value, id)

// ── Display helpers ───────────────────────────────────────────────────────────

const toTitleCase = str => str ? str.replace(/(?<!['‘’‚‛′])\b\w/g, c => c.toUpperCase()) : ''

const playerLabel = (characterName, standing) => characterName
  ? `Rank ${standing} ${toTitleCase(characterName)}`
  : `Rank ${standing}`

function formatDate(iso) {
  const [y, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
}

function resultClass(result) {
  if (!result) return ''
  if (result.startsWith('W')) return 'result-win'
  if (result.startsWith('L')) return 'result-loss'
  if (result.startsWith('D')) return 'result-draw'
  return ''
}

function opponentRoute(opponentStanding) {
  if (!opponentStanding || !eventId.value) return null
  const s = getStanding(eventId.value, opponentStanding)
  return s?.hasDeck ? `/majors/${eventId.value}/${opponentStanding}` : null
}

const deckCount = id => getStandings(id).filter(s => s.hasDeck).length

// ── Season tabs ───────────────────────────────────────────────────────────────
// Newest season first, so the most recent Worlds is what opens.

const SEASONS = [...new Set(events.map(e => e.season))].sort().reverse()
const tab = ref(SEASONS[0] ?? '')

// Within a season, group by tier so it reads Worlds → LCQ → Nationals →
// Majors → Regionals rather than as one flat chronological run.
const seasonGroups = computed(() => {
  const inSeason = events.filter(e => e.season === tab.value).sort(compareEvents)
  return TIERS
    .map(t => ({ tier: t, events: inSeason.filter(e => e.tier === t.key) }))
    .filter(g => g.events.length)
})

const seasonStats = computed(() => {
  const inSeason = events.filter(e => e.season === tab.value)
  return {
    events: inSeason.length,
    players: inSeason.reduce((s, e) => s + e.playerCount, 0),
    decks: inSeason.reduce((s, e) => s + deckCount(e.id), 0),
  }
})

// ── Character filter ──────────────────────────────────────────────────────────
// Typing a character name collapses the season browser into a flat list of every
// matching deck across every major.

const search = ref('')
const searchNorm = computed(() => normName((search.value || '').trim()))
const isFiltering = computed(() => searchNorm.value.length > 0)

const filteredStandings = computed(() => {
  const q = searchNorm.value
  if (!q) return []
  const out = []
  for (const ev of events) {
    for (const s of getStandings(ev.id)) {
      if (s.hasDeck && s.characterName && normName(s.characterName).includes(q)) {
        out.push({ ...s, event: ev })
      }
    }
  }
  out.sort((a, b) => b.event.date.localeCompare(a.event.date) || a.standing - b.standing)
  return out
})

// ── Current selection ─────────────────────────────────────────────────────────

const currentEvent     = computed(() => eventId.value ? getEvent(eventId.value) : null)

// The shard is the season of whichever event's deck is open.
async function ensurePlayerData() {
  const season = currentEvent.value?.season
  if (!season || season === loadedSeason) return
  loadedSeason = season
  playerDataLoading.value = true
  try {
    const shard = await deckData.load(season)
    if (loadedSeason === season) playerData.value = shard
  } catch (err) {
    console.error('[majors] deck data failed to load', err)
    if (loadedSeason === season) { playerData.value = null; loadedSeason = null }
  } finally {
    if (loadedSeason === season || loadedSeason === null) playerDataLoading.value = false
  }
}
watch([playerId, currentEvent], ([id]) => { if (id) ensurePlayerData() }, { immediate: true })
const currentStandings = computed(() => eventId.value ? getStandings(eventId.value) : [])
const currentStanding  = computed(() =>
  eventId.value && playerId.value ? getStanding(eventId.value, playerId.value) : null
)

const playerCards = computed(() => {
  if (!currentStanding.value) return {}
  const out = {}
  for (const c of getPlayerCards(currentStanding.value.id)) {
    (out[c.section] ??= []).push(c)
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

const focusedCard = ref(null)
watch(currentStanding, () => { focusedCard.value = null })

const resolvedFace = computed(() => {
  const dc = playerCards.value.character?.[0]
  if (!dc) return null
  // Goes through the shared resolver so the canonical uvsId join is used. This
  // used to key on dc.cardeioId, which the pipelines no longer export — leaving
  // it would have silently degraded face-card lookup to name matching.
  const card = resolveCard(dc)
  return card.type === 'unknown' ? null : card
})
const resolvedDeck = computed(() => (playerCards.value.main || []).map(resolveCard))
const resolvedSide = computed(() => (playerCards.value.sideboard || []).map(resolveCard))

// ── Deck store integration ────────────────────────────────────────────────────

const deckStore = useDeckStore()
const { hasDeck } = storeToRefs(deckStore)

const deckLabel = () => currentStanding.value?.deckName
  || `${currentEvent.value?.name ?? 'Major'} Deck`

function buildThisDeck() {
  deckStore.loadFromCards({
    face: resolvedFace.value, deck: resolvedDeck.value,
    side: resolvedSide.value, name: deckLabel(),
  })
}

function downloadTTS() {
  downloadTTSJson(deckLabel(), resolvedFace.value, resolvedDeck.value, resolvedSide.value)
}

// The same JSON, served by netlify/edge-functions/deck-tts.js, so a TTS mod
// can load the deck from a URL instead of a downloaded file.
const ttsLinkCopied = ref(false)
async function copyTTSLink() {
  const url = `${location.origin}/majors/${encodeURIComponent(eventId.value)}/${playerId.value}/tts.json`
  await copyToClipboard(url)
  ttsLinkCopied.value = true
  setTimeout(() => { ttsLinkCopied.value = false }, 1500)
}

function compareThisDeck() {
  deckStore.setPendingComparison({
    face: resolvedFace.value, deck: resolvedDeck.value,
    side: resolvedSide.value, name: deckLabel(),
  })
  router.push('/compare')
}

// ── Page title ────────────────────────────────────────────────────────────────

watchEffect(() => {
  if (playerId.value && currentStanding.value) {
    const label = playerLabel(currentStanding.value.characterName, playerId.value)
    setPageTitle(currentEvent.value ? `${label} · ${currentEvent.value.name}` : label)
  } else if (eventId.value && currentEvent.value) {
    setPageTitle(currentEvent.value.name)
  } else {
    setPageTitle('Majors')
  }
})
</script>

<template>
  <q-page>

    <!-- ── Deck detail (/majors/:event/:id) ──────────────────────────────── -->
    <template v-if="eventId && playerId">
      <q-toolbar class="bg-grey-2 deck-toolbar">
        <q-btn flat dense icon="arrow_back" @click="router.push(`/majors/${eventId}`)" />
        <q-toolbar-title class="text-body1 deck-toolbar__title">
          <q-breadcrumbs class="text-body2" active-color="primary" gutter="xs">
            <q-breadcrumbs-el label="Majors" icon="military_tech" to="/majors" />
            <q-breadcrumbs-el :label="currentEvent?.name ?? eventId" :to="`/majors/${eventId}`" />
            <q-breadcrumbs-el :label="`Rank ${playerId}`" />
          </q-breadcrumbs>
        </q-toolbar-title>
        <div class="deck-toolbar__actions">
          <q-btn-toggle
            v-model="majorsView" dense unelevated no-caps class="q-mr-xs"
            color="grey-3" text-color="grey-7" toggle-color="grey-7" toggle-text-color="white"
            :options="[{ value: 'tiles', icon: 'grid_view' }, { value: 'list', icon: 'view_list' }]"
            @update:model-value="setMajorsView"
          />
          <q-slider
            v-if="majorsView === 'tiles'"
            v-model="majorsColumns" :min="3" :max="12" :step="1" snap
            style="width: 90px" class="q-mx-sm gt-xs" color="primary"
          />
          <template v-if="currentStanding?.hasDeck">
            <q-btn flat dense icon="style" size="sm" label="Build" class="q-ml-xs"
              :disable="playerDataLoading || !resolvedDeck.length" @click="buildThisDeck">
              <q-tooltip>Load this deck into the app</q-tooltip>
            </q-btn>
            <q-btn v-if="hasDeck" flat dense icon="difference" size="sm" label="Compare" class="q-ml-xs"
              :disable="playerDataLoading || !resolvedDeck.length" @click="compareThisDeck">
              <q-tooltip>Compare against your current deck</q-tooltip>
            </q-btn>
            <q-btn flat dense icon="download" size="sm" label="TTS" class="q-ml-xs"
              :disable="playerDataLoading || !resolvedDeck.length" @click="downloadTTS">
              <q-tooltip>Download Tabletop Simulator deck</q-tooltip>
            </q-btn>
            <q-btn flat dense :icon="ttsLinkCopied ? 'check' : 'link'" size="sm" class="q-ml-xs"
              @click="copyTTSLink">
              <q-tooltip>Copy a link for the BuildUVS Deck Importer in Tabletop Simulator</q-tooltip>
            </q-btn>
          </template>
        </div>
      </q-toolbar>

      <div v-if="playerDataLoading" class="text-center q-pa-xl">
        <q-spinner size="3rem" color="primary" />
      </div>

      <div v-else-if="currentStanding" class="q-pa-md">
        <DeckStage
          :face-asset="(focusedCard || resolvedFace)?.asset ?? null"
          :face-name="(focusedCard || resolvedFace)?.name ?? ''"
          :list-view="majorsView === 'list'"
        >
          <DeckBody
            v-if="resolvedDeck.length"
            :deck-list="resolvedDeck" :side-list="resolvedSide"
            :view="majorsView" :columns="majorsColumns" :editable="false"
            @card-click="focusedCard = $event"
          />
        </DeckStage>

        <div v-if="playerMatches.swiss?.length || playerMatches.topcut?.length" class="q-mt-md">
          <div v-if="playerMatches.swiss?.length" class="deck-section">
            <div class="deck-section__title">Swiss · {{ currentStanding.swissRecord ?? '' }}</div>
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
      </div>
    </template>

    <!-- ── Event detail (/majors/:event) ─────────────────────────────────── -->
    <template v-else-if="eventId">
      <q-toolbar class="bg-grey-2">
        <q-btn flat dense icon="arrow_back" @click="router.push('/majors')" />
        <q-toolbar-title class="text-body1">
          <q-breadcrumbs class="text-body2" active-color="primary" gutter="xs">
            <q-breadcrumbs-el label="Majors" icon="military_tech" to="/majors" />
            <q-breadcrumbs-el :label="currentEvent?.name ?? eventId" />
          </q-breadcrumbs>
          <span class="text-caption text-grey-6 q-ml-sm">
            {{ currentEvent ? `${currentEvent.location} · ${formatDate(currentEvent.date)}` : '' }}
          </span>
        </q-toolbar-title>
        <q-badge v-if="currentEvent" :color="tierInfo(currentEvent.tier).color"
          :label="tierInfo(currentEvent.tier).label" class="q-mr-sm" />
        <q-badge color="grey-6" :label="`${currentEvent?.playerCount} players`" />
      </q-toolbar>

      <q-list separator>
        <q-item v-for="s in currentStandings" :key="s.standing"
          :class="{
            'row-winner': s.standing === 1,
            'row-top4':   s.standing > 1 && s.standing <= 4,
            'row-top8':   s.standing > 4 && s.standing <= 8,
          }"
          :clickable="!!s.hasDeck"
          :to="s.hasDeck ? `/majors/${eventId}/${s.standing}` : undefined">
          <q-item-section avatar style="min-width: 52px">
            <div style="position: relative; display: inline-block">
              <q-avatar v-if="findCard(s.characterName)" square size="40px" class="standing-avatar">
                <img :src="getCardImage(findCard(s.characterName).asset)" class="card-thumb__img" />
              </q-avatar>
              <q-avatar v-else square size="40px" class="standing-avatar bg-grey-3" />
              <ResourceSymbol v-if="s.deckSymbol" :element="s.deckSymbol" class="standing-resource" />
            </div>
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ playerLabel(s.characterName, s.standing) }}</q-item-label>
            <q-item-label v-if="s.overallRecord ?? s.swissRecord" caption>
              {{ s.overallRecord ?? s.swissRecord }}
            </q-item-label>
          </q-item-section>
          <q-item-section side v-if="s.hasDeck">
            <q-icon name="chevron_right" color="grey-5" />
          </q-item-section>
        </q-item>
      </q-list>
    </template>

    <!-- ── Season browser (/majors) ──────────────────────────────────────── -->
    <template v-else>
      <div class="row items-center bg-grey-2">
        <q-tabs v-if="!isFiltering" v-model="tab" align="left" dense class="col text-grey-8">
          <q-tab v-for="s in SEASONS" :key="s" :name="s" :label="seasonLabel(s)" />
        </q-tabs>
        <div v-else class="col text-grey-8 q-pl-md text-body2">
          {{ filteredStandings.length }} {{ filteredStandings.length === 1 ? 'deck' : 'decks' }}
        </div>
        <q-input v-model="search" dense outlined clearable debounce="150" bg-color="white"
          placeholder="Character…" class="q-mr-sm majors-search">
          <template v-slot:prepend><q-icon name="search" size="xs" /></template>
        </q-input>
      </div>

      <!-- Character filter results across every major -->
      <q-list v-if="isFiltering" separator>
        <q-item v-for="s in filteredStandings" :key="`${s.event.id}-${s.standing}`"
          :class="{
            'row-winner': s.standing === 1,
            'row-top4':   s.standing > 1 && s.standing <= 4,
            'row-top8':   s.standing > 4 && s.standing <= 8,
          }"
          clickable :to="`/majors/${s.event.id}/${s.standing}`">
          <q-item-section avatar style="min-width: 52px">
            <div style="position: relative; display: inline-block">
              <q-avatar v-if="findCard(s.characterName)" square size="40px" class="standing-avatar">
                <img :src="getCardImage(findCard(s.characterName).asset)" class="card-thumb__img" />
              </q-avatar>
              <q-avatar v-else square size="40px" class="standing-avatar bg-grey-3" />
              <ResourceSymbol v-if="s.deckSymbol" :element="s.deckSymbol" class="standing-resource" />
            </div>
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ playerLabel(s.characterName, s.standing) }}</q-item-label>
            <q-item-label caption>{{ s.event.name }} · {{ formatDate(s.event.date) }}</q-item-label>
          </q-item-section>
          <q-item-section side><q-icon name="chevron_right" color="grey-5" /></q-item-section>
        </q-item>
        <q-item v-if="!filteredStandings.length">
          <q-item-section class="text-grey-6 text-center q-py-lg">
            No decks match “{{ search }}”
          </q-item-section>
        </q-item>
      </q-list>

      <template v-else>
        <div class="q-px-md q-pt-sm text-caption text-grey-6">
          {{ seasonStats.events }} events · {{ seasonStats.players }} players · {{ seasonStats.decks }} decklists
        </div>

        <div v-for="g in seasonGroups" :key="g.tier.key" class="q-mt-sm">
          <div class="tier-heading">
            <q-badge :color="g.tier.color" :label="g.tier.label" />
          </div>
          <q-list separator>
            <q-item v-for="e in g.events" :key="e.id" clickable :to="`/majors/${e.id}`">
              <q-item-section avatar style="min-width: 52px">
                <q-avatar v-if="findCard(e.winnerCharacter)" square size="40px" class="standing-avatar">
                  <img :src="getCardImage(findCard(e.winnerCharacter).asset)" class="card-thumb__img" />
                </q-avatar>
                <q-avatar v-else square size="40px" class="standing-avatar bg-grey-3" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ e.name }}</q-item-label>
                <q-item-label caption>
                  {{ e.location }} · {{ formatDate(e.date) }} ·
                  {{ deckCount(e.id) }} of {{ e.playerCount }} lists
                </q-item-label>
              </q-item-section>
              <q-item-section side><q-icon name="chevron_right" color="grey-5" /></q-item-section>
            </q-item>
          </q-list>
        </div>
      </template>
    </template>

  </q-page>
</template>

<style scoped>
.majors-search { width: 180px; }
.majors-search :deep(.q-field__control) { height: 34px; min-height: 34px; }
@media (max-width: 1023px) {
  .majors-search { flex: 1 1 100%; order: 1; width: auto; margin: 4px 8px; }
}

.deck-toolbar { flex-wrap: wrap; }
.deck-toolbar__title { min-width: 0; }
.deck-toolbar__actions { display: flex; align-items: center; flex-wrap: wrap; }
@media (max-width: 599px) {
  .deck-toolbar__actions { flex: 1 1 100%; justify-content: flex-end; padding-bottom: 4px; }
}

.tier-heading { padding: 6px 16px 2px; }

.standing-resource {
  position: absolute;
  bottom: -2px;
  right: -2px;
  font-size: 18px;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
}

.standing-avatar { overflow: hidden; }
.standing-avatar .card-thumb__img {
  width: 100%; height: 100%;
  object-fit: cover; object-position: top;
  transform: scale(1.4); transform-origin: top center;
}

.row-winner { background: rgba(255, 190, 0, 0.12); }
.row-top4   { background: rgba(0, 170, 90, 0.07); }
.row-top8   { background: rgba(0, 90, 200, 0.04); }

.deck-section { margin-bottom: 1.25rem; }
.deck-section__title {
  font-size: 0.72rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: #999;
  border-bottom: 1px solid rgba(0,0,0,0.1);
  padding-bottom: 3px; margin-bottom: 6px;
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
</style>
