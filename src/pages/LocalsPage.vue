<script setup>
import { ref, computed, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { setPageTitle } from 'src/js/page_title'
import indexData from 'src/assets/locals-index.json'
import DeckBody from 'src/components/deck/DeckBody.vue'
import DeckStage from 'src/components/deck/DeckStage.vue'
import cardeioIdsData from 'src/assets/cardeio-ids.json'
import { cards as allCards } from 'src/js/card_provider.js'
import { getCardImage } from 'src/js/image_helper'
import ResourceSymbol from 'src/components/cards/detail/ResourceSymbol.vue'
import { useDeckStore } from 'src/stores/deck'
import { storeToRefs } from 'pinia'
import { downloadTTSJson } from 'src/js/tts_export'
import { LC_FORMATS, eventName } from 'src/js/event_naming'

// Normalize apostrophes and other quote variants to plain straight apostrophe
function normName(name) {
  return name.toLowerCase().replace(/[‘’‚‛′]/g, "'")
}

const standardCards = allCards.filter(c => c.formats?.includes('standard'))
const cardByName = new Map(standardCards.map(c => [normName(c.name), c]))
// A deck card's cardeioId (assigned by gen-locals from cardeio-ids.json) shares
// the card DB's own cardeio_id space. Key by both:
//  - the cardeio-ids.json name-hop (legacy path, covers cards lacking a DB id), then
//  - each card's own cardeio_id (authoritative; overrides the above), which joins
//    directly and sidesteps deck↔DB name mismatches — diacritics ("Donny’s Bō
//    Staff" vs "Bo"), stray quotes ('"I Would Like to Rage!"'), or a dropped word
//    ("…the Star Razor").
const cardByCardeioId = new Map(
  Object.entries(cardeioIdsData)
    .map(([name, data]) => [data.id, cardByName.get(normName(name))])
    .filter(([, card]) => card != null)
)
for (const c of standardCards) if (c.cardeio_id) cardByCardeioId.set(c.cardeio_id, c)

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

// ── Deck display view (tiles vs text list) ─────────────────────────────────────
// A shared link may pin the initial view with ?view=tiles|list and ?cols=N (3–12),
// e.g. /lists/<event>/<id>?view=tiles&cols=8. The query only seeds the opening
// view — it never overwrites the visitor's own saved default in localStorage.

const qView = route.query.view
const qCols = Number(route.query.cols)

const listsView = ref(
  (qView === 'tiles' || qView === 'list')
    ? qView
    : (localStorage.getItem('listsView') || 'list')
)
function setListsView(v) {
  listsView.value = v
  localStorage.setItem('listsView', v)
}
const listsColumns = ref(
  (Number.isInteger(qCols) && qCols >= 3 && qCols <= 12)
    ? qCols
    : (Number(localStorage.getItem('listsColumns')) || 6)
)
function setListsColumns(n) {
  listsColumns.value = n
  localStorage.setItem('listsColumns', String(n))
}

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
  return str ? str.replace(/(?<!['‘’‚‛′])\b\w/g, c => c.toUpperCase()) : ''
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
  return s?.hasDeck ? `/lists/${eventId.value}/${opponentStanding}` : null
}

// ── Computed views ─────────────────────────────────────────────────────────────

const lcFormatKeys = new Set(LC_FORMATS.map(f => f.key))

const sortOrder = ref('decklists')

const deckCount = id => getStandings(id).filter(s => s.hasDeck).length

function sortEvents(evList, order = sortOrder.value) {
  return [...evList].sort((a, b) => {
    if (order === 'date') return b.date.localeCompare(a.date)
    const aCount = deckCount(a.id)
    const bCount = deckCount(b.id)
    if (bCount !== aCount) return bCount - aCount
    if (b.playerCount !== a.playerCount) return b.playerCount - a.playerCount
    return a.date.localeCompare(b.date)
  })
}

const lcEvents = events.filter(e => e.round !== 0)
const regionalEvents = events.filter(e => e.round === 0).sort((a, b) => a.date.localeCompare(b.date))

const regionalTabs = regionalEvents.map(e => ({
  key: e.id,
  label: `${eventName(e)} · ${formatDate(e.date)}`,
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
].sort((a, b) => b.sortDate.localeCompare(a.sortDate))

const eventsByFormat = computed(() => ({
  ...Object.fromEntries(LC_FORMATS.map(f => [f.key, sortEvents(lcEvents.filter(e => e.formatPeriod === f.key))])),
  ...Object.fromEntries(regionalEvents.map(e => [e.id, [e]])),
}))

const tab = ref(FORMATS[0]?.key ?? 'kaiju')

// A regional tab's key is an event id (LC format tabs use a format key). Since a
// regional is always a single event, page straight into its standings instead of
// showing a one-row event list.
const tabEvent     = computed(() => getEvent(tab.value))
const tabStandings = computed(() => tabEvent.value ? getStandings(tab.value) : [])

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
  const found = (dc.cardeioId && cardByCardeioId.get(dc.cardeioId)) || findCard(dc.name)
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

function downloadTTS() {
  const name = currentStanding.value?.deckName || 'UVS Deck'
  downloadTTSJson(name, resolvedFace.value, resolvedDeck.value, resolvedSide.value)
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

const focusedCard = ref(null)
watch(() => currentStanding.value, () => { focusedCard.value = null })

const resolvedFace = computed(() => {
  const chars = playerCards.value.character
  if (!chars?.length) return null
  const dc = chars[0]
  const found = (dc.cardeioId && cardByCardeioId.get(dc.cardeioId)) || findCard(dc.name)
  if (!found) console.warn(`[locals] unresolved face card: "${dc.name}"`)
  return found || null
})
const resolvedDeck = computed(() => (playerCards.value.main || []).map(resolveCard))
const resolvedSide = computed(() => (playerCards.value.sideboard || []).map(resolveCard))

// Describe the current view in the browser tab / history entry.
watchEffect(() => {
  if (playerId.value && currentStanding.value) {
    const label = playerLabel(currentStanding.value.characterName, playerId.value)
    setPageTitle(currentEvent.value ? `${label} · ${eventName(currentEvent.value)}` : label)
  } else if (eventId.value && currentEvent.value) {
    setPageTitle(eventName(currentEvent.value))
  } else {
    setPageTitle('Decklists')
  }
})
</script>

<template>
  <q-page>

    <!-- ── Player detail (/locals/:event/:id) ─────────────────────────────── -->
    <template v-if="playerId">
      <q-toolbar class="bg-grey-2 deck-toolbar">
        <q-btn flat dense icon="arrow_back" @click="router.push(`/lists/${eventId}`)" />
        <q-toolbar-title class="text-body1 deck-toolbar__title">
          <q-breadcrumbs class="text-body2" active-color="primary" gutter="xs">
            <q-breadcrumbs-el label="Decklists" icon="emoji_events" to="/lists" />
            <q-breadcrumbs-el :label="currentEvent ? eventName(currentEvent) : eventId" :to="`/lists/${eventId}`" />
            <q-breadcrumbs-el :label="playerLabel(currentStanding?.characterName, playerId)" />
          </q-breadcrumbs>
          <span v-if="currentStanding?.deckName" class="text-caption text-grey-6 q-ml-sm">
            {{ currentStanding.deckName }}
          </span>
        </q-toolbar-title>
        <div class="deck-toolbar__actions">
          <q-badge v-if="currentStanding?.overallRecord ?? currentStanding?.swissRecord" color="grey-6"
            :label="currentStanding.overallRecord ?? currentStanding.swissRecord" class="q-mr-sm" />
          <template v-if="currentStanding?.hasDeck">
            <q-btn-toggle
              :model-value="listsView"
              @update:model-value="setListsView"
              flat
              dense
              no-caps
              toggle-color="primary"
              :options="[
                { value: 'list', icon: 'view_list', slot: 'list' },
                { value: 'tiles', icon: 'grid_view', slot: 'tiles' },
              ]"
            >
              <template v-slot:list><q-tooltip>Text list</q-tooltip></template>
              <template v-slot:tiles><q-tooltip>Card tiles</q-tooltip></template>
            </q-btn-toggle>
            <q-slider
              v-if="listsView === 'tiles'"
              :model-value="listsColumns"
              @update:model-value="setListsColumns"
              :min="3"
              :max="12"
              :step="1"
              snap
              style="width: 90px"
              class="q-mx-sm gt-xs"
              color="primary"
            />
          </template>
          <template v-if="currentStanding?.hasDeck">
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
            <q-btn flat dense icon="download" size="sm" label="TTS" class="q-ml-xs"
              :disable="playerDataLoading || !resolvedDeck.length"
              @click="downloadTTS">
              <q-tooltip>Download Tabletop Simulator deck</q-tooltip>
            </q-btn>
          </template>
        </div>
      </q-toolbar>

      <div v-if="playerDataLoading" class="text-center q-pa-xl">
        <q-spinner size="3rem" color="primary" />
      </div>

      <div v-else-if="currentStanding" class="q-pa-md">

        <!-- Face card + decklist -->
        <DeckStage
          :face-asset="(focusedCard || resolvedFace)?.asset ?? null"
          :face-name="(focusedCard || resolvedFace)?.name ?? ''"
          :list-view="listsView === 'list'"
        >
          <DeckBody
            v-if="resolvedDeck.length"
            :deck-list="resolvedDeck"
            :side-list="resolvedSide"
            :view="listsView"
            :columns="listsColumns"
            :editable="false"
            @card-click="focusedCard = $event"
          />
        </DeckStage>

        <!-- Match results -->
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

    <!-- ── Event detail (/locals/:event) ─────────────────────────────────── -->
    <template v-else-if="eventId">
      <q-toolbar class="bg-grey-2">
        <q-btn flat dense icon="arrow_back" @click="router.push('/lists')" />
        <q-toolbar-title class="text-body1">
          <q-breadcrumbs class="text-body2" active-color="primary" gutter="xs">
            <q-breadcrumbs-el label="Decklists" icon="emoji_events" to="/lists" />
            <q-breadcrumbs-el :label="currentEvent ? eventName(currentEvent) : eventId" />
          </q-breadcrumbs>
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
          :clickable="!!s.hasDeck"
          :to="s.hasDeck ? `/lists/${eventId}/${s.standing}` : undefined">
          <q-item-section avatar style="min-width: 52px">
            <div style="position: relative; display: inline-block">
              <q-avatar v-if="findCard(s.characterName)" square size="40px" class="standing-avatar">
                <img :src="getCardImage(findCard(s.characterName).asset)" class="card-thumb__img" />
              </q-avatar>
              <q-avatar v-else square size="40px" class="standing-avatar bg-grey-3" />
              <ResourceSymbol
                v-if="s.deckSymbol"
                :element="s.deckSymbol"
                class="standing-resource"
              />
            </div>
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ playerLabel(s.characterName, s.standing) }}</q-item-label>
            <q-item-label v-if="s.overallRecord ?? s.swissRecord" caption>{{ s.overallRecord ?? s.swissRecord }}</q-item-label>
          </q-item-section>
          <q-item-section side v-if="s.hasDeck">
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
        <q-badge v-if="tabEvent" color="grey-6" class="q-mr-sm"
          :label="`${tabEvent.playerCount} players`" />
        <q-btn-toggle v-else v-model="sortOrder" dense unelevated no-caps
          class="q-mr-sm"
          color="grey-3" text-color="grey-7" toggle-color="grey-7" toggle-text-color="white"
          :options="[
            { value: 'decklists', icon: 'list_alt' },
            { value: 'date',      icon: 'calendar_today' },
          ]">
          <q-tooltip :delay="300">{{ sortOrder === 'decklists' ? 'Sorted by available lists' : 'Sorted by date' }}</q-tooltip>
        </q-btn-toggle>
      </div>

      <!-- Regional tab: standings directly (always exactly one event) -->
      <q-list v-if="tabEvent" separator>
        <q-item v-for="s in tabStandings" :key="s.standing"
          :class="{
            'row-winner': s.standing === 1,
            'row-top4':   s.standing > 1 && s.standing <= 4,
            'row-top8':   s.standing > 4 && s.standing <= 8,
          }"
          :clickable="!!s.hasDeck"
          :to="s.hasDeck ? `/lists/${tab}/${s.standing}` : undefined">
          <q-item-section avatar style="min-width: 52px">
            <div style="position: relative; display: inline-block">
              <q-avatar v-if="findCard(s.characterName)" square size="40px" class="standing-avatar">
                <img :src="getCardImage(findCard(s.characterName).asset)" class="card-thumb__img" />
              </q-avatar>
              <q-avatar v-else square size="40px" class="standing-avatar bg-grey-3" />
              <ResourceSymbol
                v-if="s.deckSymbol"
                :element="s.deckSymbol"
                class="standing-resource"
              />
            </div>
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ playerLabel(s.characterName, s.standing) }}</q-item-label>
            <q-item-label v-if="s.overallRecord ?? s.swissRecord" caption>{{ s.overallRecord ?? s.swissRecord }}</q-item-label>
          </q-item-section>
          <q-item-section side v-if="s.hasDeck">
            <q-icon name="chevron_right" color="grey-5" />
          </q-item-section>
        </q-item>
      </q-list>

      <!-- LC format tab: list of events -->
      <q-list v-else separator>
        <q-item v-for="ev in eventsByFormat[tab]" :key="ev.id"
          clickable v-ripple :to="`/lists/${ev.id}`">
          <q-item-section avatar style="min-width: 56px">
            <div class="text-caption text-mono text-grey-7">{{ formatDate(ev.date) }}</div>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">{{ ev.location }}</q-item-label>
            <q-item-label caption>
              {{ deckCount(ev.id) }} lists
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

/* Toolbar: keep the breadcrumb title and the action controls from colliding.
   On phones the actions drop to their own full-width row below the title
   instead of clipping into the breadcrumbs. */
.deck-toolbar { flex-wrap: wrap; }
.deck-toolbar__title { min-width: 0; }
.deck-toolbar__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
@media (max-width: 599px) {
  .deck-toolbar__actions {
    flex: 1 1 100%;
    justify-content: flex-end;
    padding-bottom: 4px;
  }
}

.standing-avatar { overflow: hidden; }
.standing-avatar .card-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  transform: scale(1.4);
  transform-origin: top center;
}
.standing-resource {
  position: absolute;
  bottom: -2px;
  right: -2px;
  font-size: 18px;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
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
</style>
