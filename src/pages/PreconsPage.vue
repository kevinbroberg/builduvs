<script setup>
import { ref, computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { copyToClipboard } from 'quasar'
import { setPageTitle } from 'src/js/page_title'
import releaseData from 'src/assets/releases.json'
import derivedData from 'src/assets/precons-derived.json'
import officialDecks from 'src/assets/official-decks.json'
import communityDecks from 'src/assets/precon-decks-uvsultra.json'
import inferredDecks from 'src/assets/precon-decks-inferred.json'
import DeckBody from 'src/components/deck/DeckBody.vue'
import DeckStage from 'src/components/deck/DeckStage.vue'
import { createCardResolver } from 'src/js/decklist_cards'
import { getCardImage } from 'src/js/image_helper'
import { cards as allCards } from 'src/js/card_provider'
import { downloadTTSJson } from 'src/js/tts_export'
import { buildPrecons } from 'src/js/precon_rows'

const route = useRoute()

// Precons reach back past the current Standard pool, so resolve against every
// printing rather than the standard-only pool /lists uses.
const { resolveCard } = createCardResolver({ standardOnly: false })

const { decks: allDecks, rows: allRows } = buildPrecons({
  releaseData, derivedData, officialDecks, communityDecks, inferredDecks,
})

// ── One official decklist (/precons/:deck) ───────────────────────────────────

const deckId = computed(() => route.params.deck || null)
const currentDeck = computed(() =>
  deckId.value ? allDecks.find(d => d.id === deckId.value) ?? null : null)

// Community lists identify a card by set + collector number, which is more
// precise than resolveCard's name lookup — a name alone can land on a later
// reprint in a different set (a 2017 Cowboy Bebop deck showing cb02 art from
// the 2024 Challenger Series). Keep the printing the source recorded: the whole
// card where we have it, since the TTS export takes its image from the card's
// own fields; failing that, at least its asset for the image here.
const cardByAsset = new Map(allCards.map(c => [c.asset, c]))
const sectionCards = (deck, name) =>
  (deck?.sections.find(s => s.name === name)?.cards ?? []).map(c => {
    const printed = c.asset && cardByAsset.get(c.asset)
    if (printed) return { ...printed, qty: c.count }
    const r = resolveCard({ cardeioId: c.cardeioId, name: c.name, qty: c.count })
    return c.asset ? { ...r, asset: c.asset } : r
  })

// Some precons ship two or three characters; the page shows the first, the
// TTS export puts them all face up.
const resolvedFaces = computed(() => sectionCards(currentDeck.value, 'character'))
const resolvedFace = computed(() => resolvedFaces.value[0] ?? null)
const resolvedDeck = computed(() => sectionCards(currentDeck.value, 'main'))
const resolvedSide = computed(() => sectionCards(currentDeck.value, 'sideboard'))
const focusedCard = ref(null)

// Mirrors /lists and /majors so the three pages share one saved preference.
const listsView = ref(localStorage.getItem('listsView') || 'tiles')
const listsColumns = ref(Number(localStorage.getItem('listsColumns') || 6))

function downloadTTS() {
  downloadTTSJson(currentDeck.value.name, resolvedFaces.value, resolvedDeck.value, resolvedSide.value)
}

// The same JSON, served by netlify/edge-functions/deck-tts.js, so a TTS mod
// can load the deck from a URL instead of a downloaded file.
const ttsLinkCopied = ref(false)
async function copyTTSLink() {
  const url = `${location.origin}/precons/${encodeURIComponent(currentDeck.value.id)}/tts.json`
  await copyToClipboard(url)
  ttsLinkCopied.value = true
  setTimeout(() => { ttsLinkCopied.value = false }, 1500)
}

const deckFaceAsset = d =>
  (d.sections.find(s => s.name === 'character')?.cards ?? [])[0]?.asset ?? null

const search = ref('')

const filtered = computed(() => {
  const q = (search.value || '').trim().toLowerCase()
  if (!q) return allRows
  return allRows.filter(r =>
    r.title.toLowerCase().includes(q) ||
    (r.code ?? '').toLowerCase().includes(q) ||
    (r.subtitle ?? '').toLowerCase().includes(q) ||
    (r.deck?.character ?? '').toLowerCase().includes(q) ||
    (r.deckRoster ?? []).flat().some(c => c.toLowerCase().includes(q)))
})

// Grouped by release, newest first, provenance ignored — products that shipped
// together (the two King of Fighters decks, the four Star Trek decks) sit under
// one heading. Undated products fall to the end rather than the top.
const groups = computed(() => {
  const byDate = new Map()
  for (const r of filtered.value) {
    const k = r.date ?? ''
    if (!byDate.has(k)) byDate.set(k, [])
    byDate.get(k).push(r)
  }
  return [...byDate.entries()]
    .sort((a, b) => (b[0] || '0000').localeCompare(a[0] || '0000'))
    .map(([date, items]) => ({
      date,
      precision: items[0].precision,
      items: items.sort((a, b) => a.title.localeCompare(b.title)),
    }))
})

const withDeck = computed(() => allRows.filter(r => r.deck).length)

// "2015-03" and "2022" are as precise as some sources get; render what's real
// rather than padding out a fake day.
function formatLoose(value, precision) {
  if (!value) return 'Release date not established'
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const [y, m, d] = value.split('-')
  if (precision === 'day' && d) return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
  return m ? `${months[parseInt(m) - 1]} ${y}` : y
}

watchEffect(() => setPageTitle(currentDeck.value ? currentDeck.value.name : 'Precon Decks'))
</script>

<template>
  <q-page>

    <!-- ── One official decklist ──────────────────────────────────────────── -->
    <template v-if="deckId">
      <div v-if="!currentDeck" class="text-grey-6 text-center q-py-xl">
        No official decklist with that id.
        <div class="q-mt-sm"><router-link to="/precons">Back to precon decks</router-link></div>
      </div>
      <template v-else>
        <div class="row items-center bg-grey-2 q-py-xs">
          <q-btn flat dense round icon="arrow_back" to="/precons" class="q-ml-sm" />
          <div class="col q-pl-sm">
            <div class="text-body1">{{ currentDeck.name }}</div>
            <div class="text-caption text-grey-7">
              Decklist · {{ currentDeck.totalCards }} cards
              <template v-if="currentDeck.provenance === 'inferred'">
                · quantities inferred from rarity, not yet published by UVS
              </template>
            </div>
          </div>
          <q-btn flat dense icon="download" size="sm" label="TTS" class="q-mr-xs"
            :disable="!resolvedDeck.length"
            @click="downloadTTS">
            <q-tooltip>Download Tabletop Simulator deck</q-tooltip>
          </q-btn>
          <q-btn flat dense :icon="ttsLinkCopied ? 'check' : 'link'" size="sm" class="q-mr-sm"
            @click="copyTTSLink">
            <q-tooltip>Copy a link for the BuildUVS Deck Importer in Tabletop Simulator</q-tooltip>
          </q-btn>
          <q-btn-toggle v-model="listsView" dense flat class="q-mr-sm" toggle-color="primary"
            :options="[{ value: 'tiles', icon: 'grid_view' }, { value: 'list', icon: 'view_list' }]" />
        </div>
        <div class="q-pa-md">
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
        </div>
      </template>
    </template>

    <!-- ── Index: one timeline, grouped by release ────────────────────────── -->
    <template v-else>
      <div class="row items-center bg-grey-2">
        <div class="col text-grey-8 q-pl-md text-body2">
          {{ filtered.length }} {{ filtered.length === 1 ? 'product' : 'products' }}
          <span v-if="!search" class="text-grey-6">· {{ withDeck }} with a decklist</span>
        </div>
        <q-input v-model="search" dense outlined clearable debounce="150" bg-color="white"
          placeholder="Product, set code, character…" class="q-mr-sm precons-search">
          <template v-slot:prepend><q-icon name="search" size="xs" /></template>
        </q-input>
      </div>

      <div v-for="g in groups" :key="g.date || 'undated'" class="q-mt-sm">
        <div class="year-heading">
          <q-badge :color="g.date ? 'grey-7' : 'grey-5'"
            :label="formatLoose(g.date, g.precision)" />
        </div>
        <q-list separator>
          <q-item v-for="r in g.items" :key="r.key"
            :clickable="Boolean(r.deck)"
            :to="r.deck ? `/precons/${r.deck.id}` : undefined">
            <q-item-section avatar style="min-width: 52px">
              <q-avatar v-if="r.deck && deckFaceAsset(r.deck)" square size="40px">
                <img :src="getCardImage(deckFaceAsset(r.deck))" class="deck-thumb__img" />
              </q-avatar>
              <q-badge v-else :color="r.kindColor" class="kind-dot" :label="r.code ?? '—'" />
            </q-item-section>

            <q-item-section>
              <q-item-label>
                {{ r.title }}
                <q-badge v-if="r.unnamed" color="grey-4" text-color="grey-8" class="q-ml-xs"
                  label="name not established" />
              </q-item-label>
              <q-item-label caption>
                {{ r.kindLabel }}
                <template v-if="r.deck"> · {{ r.deck.character }}</template>
                <template v-else-if="r.subtitle"> · {{ r.subtitle }}</template>
              </q-item-label>

              <!-- A deck can hold more than one character (World of Indines
                   paired them), so join within a deck and separate between. -->
              <q-item-label v-if="r.deckRoster" caption class="text-grey-8">
                Decks:
                <span v-for="(deck, i) in r.deckRoster" :key="i">
                  <span v-if="i" class="text-grey-5"> · </span>{{ deck.join(' + ') }}
                </span>
              </q-item-label>
            </q-item-section>

            <q-item-section side>
              <q-icon v-if="r.deck" name="chevron_right" color="grey-5" />
              <a v-else-if="r.source" :href="r.source" target="_blank" rel="noopener"
                class="text-grey-5" @click.stop><q-icon name="open_in_new" size="xs" /></a>
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <div v-if="!filtered.length" class="text-grey-6 text-center q-py-lg">
        Nothing matches “{{ search }}”
      </div>

      <div class="text-caption text-grey-6 q-pa-md">
        Compiled from UVS Games' own records and from decklists the community wrote down.
        Per-product sourcing lives in <code>src/assets/precons-derived.json</code>.
      </div>
    </template>
  </q-page>
</template>

<style scoped>
.precons-search { width: 240px; }
.precons-note   { border-radius: 4px; }

/* LocalsPage styles its own thumbs; scoped CSS means we need our own here. */
.deck-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.year-heading {
  padding: 10px 16px 4px;
  font-size: 12px;
}

/* Set code doubles as the kind swatch, so it needs to be readable, not tiny. */
.kind-dot {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 6px;
  justify-content: center;
  min-width: 46px;
}
</style>
