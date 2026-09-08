<script setup>
import { ref, computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { setPageTitle } from 'src/js/page_title'
import releaseData from 'src/assets/releases.json'
import derivedData from 'src/assets/precons-derived.json'
import officialDecks from 'src/assets/official-decks.json'
import communityDecks from 'src/assets/precon-decks-uvsultra.json'
import DeckBody from 'src/components/deck/DeckBody.vue'
import DeckStage from 'src/components/deck/DeckStage.vue'
import { createCardResolver } from 'src/js/decklist_cards'
import { getCardImage } from 'src/js/image_helper'

const route = useRoute()

// Precons reach back past the current Standard pool, so resolve against every
// printing rather than the standard-only pool /lists uses.
const { resolveCard } = createCardResolver({ standardOnly: false })

// ── One official decklist (/precons/:deck) ───────────────────────────────────

// Two decklist sources with different shapes: UVS's official lists arrive in
// sections, the community transcriptions as one flat card array. Normalise to
// sections so the deck view doesn't care which it got.
const asSections = d => {
  if (d.sections) return d
  const chars = d.cards.filter(c => c.type === 'character')
  const rest = d.cards.filter(c => c.type !== 'character')
  return {
    ...d,
    sections: [
      { name: 'character', cards: chars },
      { name: 'main', cards: rest },
      { name: 'sideboard', cards: [] },
    ],
  }
}

const allDecks = [
  ...officialDecks.entries.map(d => ({ ...asSections(d), provenance: 'official' })),
  ...communityDecks.entries.map(d => ({ ...asSections(d), provenance: 'community' })),
]

const deckId = computed(() => route.params.deck || null)
const currentDeck = computed(() =>
  deckId.value ? allDecks.find(d => d.id === deckId.value) ?? null : null)

// Community lists are keyed by set + character rather than a product title.
const loose = n => (n || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\d+$/, '').trim()
function communityDeckFor(extShort, characters) {
  const community = allDecks.filter(d => d.provenance === 'community')
  // Heroes Clash carries no extension_short in our card data, so fall back to
  // matching on the character alone when there's no set code to narrow by.
  const pool = extShort
    ? community.filter(d => d.extensionShort === extShort)
    : community
  for (const ch of characters ?? []) {
    const hit = pool.find(d =>
      loose(d.character) && (loose(d.character).includes(loose(ch)) || loose(ch).includes(loose(d.character))))
    if (hit) return hit
  }
  return null
}

const sectionCards = (deck, name) =>
  (deck?.sections.find(s => s.name === name)?.cards ?? []).map(c => {
    const r = resolveCard({ cardeioId: c.cardeioId, name: c.name, qty: c.count })
    // Community lists identify a card by set + collector number, which is more
    // precise than resolveCard's name lookup — a name alone can land on a later
    // reprint in a different set (a 2017 Cowboy Bebop deck showing cb02 art from
    // the 2024 Challenger Series). Keep the printing the source recorded.
    return c.asset ? { ...r, asset: c.asset } : r
  })

const resolvedFace = computed(() => sectionCards(currentDeck.value, 'character')[0] ?? null)
const resolvedDeck = computed(() => sectionCards(currentDeck.value, 'main'))
const resolvedSide = computed(() => sectionCards(currentDeck.value, 'sideboard'))
const focusedCard = ref(null)

// Mirrors /lists and /majors so the three pages share one saved preference.
const listsView = ref(localStorage.getItem('listsView') || 'tiles')
const listsColumns = ref(Number(localStorage.getItem('listsColumns') || 6))

const deckFaceAsset = d =>
  (d.sections.find(s => s.name === 'character')?.cards ?? [])[0]?.asset ?? null

// ── Matching products to their official decklist ─────────────────────────────

// Roster titles and UGN deck titles order the same words differently
// ("Star Trek: Lower Decks Beckett Mariner Challenger Series" vs "Star Trek:
// Lower Decks Challenger Series - Beckett Mariner"), so match on token
// containment: every distinctive word of the product title must appear in the
// deck title. One-way containment leaves near-misses unmatched rather than wrong.
const GENERIC = new Set(['the', 'of', 'and', 'a', 'ccg', 'universus', 'uvs'])
const words = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')
  .filter(w => w && w.length > 1 && !GENERIC.has(w))

// Where the two names share almost no vocabulary, tokens can't bridge it. Each
// of these was checked by hand against the deck's character card.
const DECK_ALIAS = {
  'GMM': 'Godzilla Challenger Series - Godzilla',
  'KRM': 'Godzilla Challenger Series - Ghidorah',
  'AOTC01': 'Attack on Titan Challenger Series',
  'MHA08': 'My Hero Academia Challenger Series - Izuku Midoriya',
  'CR03': 'Critical Role Starter Deck: Beauregard Lionett',
  'CR04': 'Critical Role Starter Deck: Percival de Rolo III',
  'SF602': 'Street Fighter 6 Challenger Series - Chun-Li & Jamie',
  'TK801-CD1': 'Tekken 8 Clash - Jin Kazama',
  'TK801-CD2': 'Tekken 8 Clash - Jun Kazama',
}

function officialFor(name, setCode) {
  const alias = setCode && DECK_ALIAS[setCode]
  if (alias) return officialDecks.entries.find(d => d.name === alias) ?? null
  const want = words(name)
  if (want.length < 2) return null
  return officialDecks.entries.find(d => {
    const have = new Set(words(d.name))
    return want.every(w => have.has(w))
  }) ?? null
}

// Roster products can also have a community list rather than an official one
// (the King of Fighters challengers, the AoT clash decks). Two ways in: the
// deck's own name sits inside the product title ("Team Hero" in "King of
// Fighters XV: Team Hero Challenger Series"), or the deck's character does
// ("Levi Ackerman" in "Levi Ackerman Clash Deck").
function communityForProduct(title, setCode) {
  const have = new Set(words(title))
  const pool = allDecks.filter(d => d.provenance === 'community')
  const bare = n => (n || '').split(',')[0]

  const candidates = pool.filter(d => {
    const byName = words(d.name)
    if (byName.length >= 2 && byName.every(x => have.has(x))) return true
    const byChar = words(bare(d.character))
    return byChar.length >= 2 && byChar.every(x => have.has(x))
  })
  if (!candidates.length) return null

  // A character can headline decks in different sets years apart — "All For
  // One" is both a 2023 League of Villains clash deck and the 2026 Final War
  // Arc one — so prefer a candidate from the product's own set. The set codes
  // don't always agree exactly (KF01 vs the cards' kf0x), hence a prefix test
  // rather than equality, with the name match as the fallback.
  const prefix = (setCode ?? '').toLowerCase().replace(/[-_].*$/, '')
  const sameSet = candidates.find(d => (d.extensionShort ?? '').toLowerCase() === prefix)
  return sameSet ?? candidates[0] ?? null
}

// ── The product list ─────────────────────────────────────────────────────────

// Preconstructed products are identified from their official product name (and
// the -CS / -CD set-code suffixes, which the roster uses where the name alone
// doesn't say "Challenger Series"). Everything not matching is a booster set,
// a promo run, or a Blitz Box, and is left off this page.
//
// Experience Bundles are deliberately excluded: despite the deck-ish name they
// are alt-art releases — reskins of existing cards, in the vein of the old Deck
// Loadable Content — not preconstructed decks. Borderlands 4 is the clearest case.
const KINDS = [
  { label: 'Challenger Series', color: 'primary',
    test: (n, c) => /Challenger Series/i.test(n) || /-CS\d/i.test(c) },
  { label: 'Clash Deck', color: 'deep-orange',
    test: (n, c) => /Clash (Starter )?Deck/i.test(n) || /-CD\d/i.test(c) },
  { label: 'Starter Deck', color: 'teal',
    test: n => /Starter Deck/i.test(n) },
]
const kindOf = e => KINDS.find(k => k.test(e.name, e.setCode ?? '')) ?? null

// Roster products (2024+) and card-derived products (pre-2024) are folded into
// one list so the page reads as a single timeline regardless of where a row
// came from. `inferred` marks the derived ones for the badge.
const rosterRows = releaseData.entries
  .map(e => ({ ...e, kind: kindOf(e) }))
  .filter(e => e.kind)
  .map(e => ({
    key: `r:${e.setCode ?? e.name}`,
    code: e.setCode,
    title: e.name,
    kindLabel: e.kind.label,
    kindColor: e.kind.color,
    date: e.releaseDate,
    precision: e.releaseDate ? 'day' : null,
    source: e.releaseDateSource,
    inferred: false,
    deck: officialFor(e.name, e.setCode) ?? communityForProduct(e.name, e.setCode),
  }))

const derivedRows = (() => {
  const bySet = new Map()
  for (const d of derivedData.entries) {
    if (!bySet.has(d.extension)) bySet.set(d.extension, { ...d, characters: [] })
    bySet.get(d.extension).characters.push(d)
  }

  const rows = []
  for (const s of bySet.values()) {
    // A set whose decks are already listed individually by the roster (the AoT
    // Levi / Mikasa Clash Decks) would otherwise appear twice — once per deck
    // from the roster and again as a set row here.
    if (s.characters.length && s.characters.every(c => c.knownProduct)) continue

    const base = {
      code: s.extensionShort,
      kindColor: 'brown-5',
      date: s.releaseDate,
      precision: s.releasePrecision,
      source: s.productSource ?? s.releaseDateSource,
      inferred: true,
      unnamed: !s.productName,
    }

    // One row per deck where the roster is known, so pre-2024 products read the
    // same way as modern ones: a row is a deck, not a boxed set.
    if (s.deckRoster?.length) {
      for (const deck of s.deckRoster) {
        const found = communityDeckFor(s.extensionShort, deck)
        rows.push({
          ...base,
          key: `d:${s.extension}:${deck.join('+')}`,
          title: deck.join(' + '),
          subtitle: s.productName ?? s.extension,
          kindLabel: found ? `${found.totalCards} cards` : 'contents not recorded',
          deck: found,
        })
      }
    } else {
      rows.push({
        ...base,
        key: `d:${s.extension}`,
        title: s.productName ?? s.extension,
        subtitle: s.productName ? s.extension : null,
        kindLabel: 'deck count unknown',
        deck: null,
      })
    }
  }
  return rows
})()

// Community lists for products no row covers yet (Penny Arcade has recorded
// precons but no starter-exclusive cards to derive a product from).
//
// Community folders also hold transcriptions of decks UVS publishes officially
// — a whole "challenger decks" folder mirrors most of the official list — so
// drop any whose character is already on a row that has a deck. The official
// list wins; a second row for the same physical deck is noise.
// Key on the FULL character name, subtitle included. The bare name repeats
// across eras — "All For One" headlines both the 2023 League of Villains clash
// deck and the 2026 Final War Arc one — while the subtitle separates them
// ("All For One" vs "All For One, Demon Lord"). Set codes can't do this job:
// the same printing is filed under sl01 by UVSUltra and sleb by our own data.
const deckKey = d => loose(d.character ?? '')

const claimed = new Set(
  [...rosterRows, ...derivedRows].map(r => r.deck).filter(Boolean).map(deckKey))

const orphanRows = allDecks
  .filter(d => d.provenance === 'community')
  .filter(d => ![...rosterRows, ...derivedRows].some(r => r.deck?.id === d.id))
  .filter(d => !claimed.has(deckKey(d)))
  .map(d => ({
    key: `c:${d.id}`,
    code: d.extensionShort,
    title: d.name,
    subtitle: d.character,
    kindLabel: `${d.totalCards} cards`,
    kindColor: 'brown-5',
    date: null,
    precision: null,
    source: d.url,
    inferred: true,
    deck: d,
  }))

const allRows = [...rosterRows, ...derivedRows, ...orphanRows]

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
            </div>
          </div>
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
