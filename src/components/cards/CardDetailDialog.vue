<script setup>
// The card-detail popup. Mounted once in MainLayout; anything opens it with
// openCardDetail(card) from src/js/card_detail.js, which leaves the URL and the
// page underneath alone. Sharing goes through a card's own link, /cards/tk802/049,
// which opens this same popup over the card browser.
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar, copyToClipboard } from 'quasar'
import { useDeckStore } from 'src/stores/deck'
import { transformTarget } from 'src/js/card_provider'
import { getCardImage } from 'src/js/image_helper'
import {
  detailCard, openCardDetail, closeCardDetail, printingsOf, showInCardBrowser,
  cardPath, cardFromPath,
} from 'src/js/card_detail'
import ManySymbols from 'src/components/cards/detail/ManySymbols.vue'
import ResourceSymbol from 'src/components/cards/detail/ResourceSymbol.vue'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const store = useDeckStore()

const card = detailCard
const open = computed({
  get: () => !!card.value,
  set: v => { if (!v) closeCardDetail() },
})

// ----- Card links -------------------------------------------------------------
const linkedCard = computed(() => cardFromPath(route.params.set, route.params.number))

watch(linkedCard, (linked, previous) => {
  if (linked) openCardDetail(linked)
  else if (previous) closeCardDetail()
}, { immediate: true })

// Only on a card's own link does the URL follow the popup: another printing is
// another link, and closing leaves the plain browser. replace, so the back
// button doesn't have to wade through them.
watch(card, c => {
  if (linkedCard.value && c !== linkedCard.value) router.replace(c ? cardPath(c) : '/cards')
})

// ----- What's shown -----------------------------------------------------------
const printings = computed(() => (card.value ? printingsOf(card.value) : []))
const otherSide = computed(() => transformTarget(card.value))
const collectorNumber = computed(() => card.value?.numero ?? card.value?.card_number ?? null)

// Bold an ability's lead-in up to its colon ("Response [Once per turn]:"), the
// way the printed card sets it apart from the effect.
function textLines(text) {
  return (text || '').split('\n').map(line => {
    const m = line.match(/^([^:.]{1,80}):(.*)$/)
    return m ? { lead: m[1] + ':', rest: m[2] } : { lead: '', rest: line }
  })
}
const showPrinted = ref(false)
watch(card, () => { showPrinted.value = false })
const shownText = computed(() =>
  textLines(showPrinted.value ? card.value?.text_original : card.value?.text))

const stats = computed(() => {
  const c = card.value
  if (!c) return []
  const out = []
  if (c.type === 'attack') {
    out.push({ label: 'Speed', value: c.speed ?? '–' })
    if (c.attack_zone) out.push({ label: `${c.attack_zone} zone`, zone: c.attack_zone })
    out.push({ label: 'Damage', value: c.damage ?? '–' })
  }
  if (c.type === 'character') {
    out.push({ label: 'Hand size', value: c.hand_size ?? '–' })
    out.push({ label: 'Vitality', value: c.vitality ?? '–' })
  } else {
    if (c.difficulty != null) out.push({ label: 'Difficulty', value: c.difficulty })
    if (c.control != null) out.push({ label: 'Control', value: c.control })
    // A backup's stamina is stored as `vitality`.
    if (c.type === 'backup' && c.vitality != null) out.push({ label: 'Stamina', value: c.vitality })
  }
  if (c.block_zone) {
    out.push({ label: `${c.block_zone} block`, value: `+${c.block_modifier ?? c.block_mod ?? 0}`, block: c.block_zone })
  }
  return out
})

const legality = computed(() => {
  const f = card.value?.formats ?? []
  const status = fmt => (f.includes(`${fmt} banned`) ? 'banned' : f.includes(fmt) ? 'legal' : 'not legal')
  return [
    { label: 'Standard', status: status('standard') },
    { label: 'Retro', status: status('retro') },
  ]
})
const LEGALITY_COLOR = { legal: 'positive', banned: 'negative', 'not legal': 'grey-6' }

// ----- Deck -------------------------------------------------------------------
const isCharacter = computed(() => card.value?.type === 'character')
const isFace = computed(() => !!card.value && store.face?.asset === card.value.asset)
const limit = computed(() => card.value?.limit || 4)
const mainQty = computed(() => (card.value ? store.deck[card.value.asset]?.qty || 0 : 0))
const sideQty = computed(() => (card.value ? store.sideQuantity(card.value.asset) : 0))

// ----- Links ------------------------------------------------------------------
function browse() {
  const c = card.value
  closeCardDetail()
  showInCardBrowser(router, c.name, c)
}

const copied = ref(false)
function copyLink() {
  // resolve().href carries the router base, so a /naruto card links back there.
  copyToClipboard(location.origin + router.resolve(cardPath(card.value)).href).then(() => {
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  })
}
</script>

<template>
  <!-- A QDialog closes on any route change, which is right over an ordinary page.
       On a card's link the route changes with the printing, so the watchers above
       take over. -->
  <q-dialog v-model="open" :no-route-dismiss="!!linkedCard" :maximized="$q.screen.lt.sm">
    <q-card v-if="card" class="card-detail">
      <q-btn class="card-detail__close" flat round dense icon="close" v-close-popup />

      <div class="card-detail__layout">
        <!-- Art, other sides and printings -->
        <div class="card-detail__art">
          <q-img
            :key="card.asset"
            class="card-detail__image"
            :src="getCardImage(card.asset)"
            :ratio="744 / 1039"
            fit="contain"
            :alt="card.name"
          />
          <q-btn
            v-if="otherSide"
            class="full-width q-mt-sm"
            outline
            no-caps
            color="purple-7"
            icon="flip_camera_android"
            :label="`Other side: ${otherSide.name}`"
            @click="openCardDetail(otherSide)"
          />
          <div v-if="printings.length > 1" class="card-detail__printings">
            <div class="text-caption text-grey-7 q-mb-xs">{{ printings.length }} printings</div>
            <div class="row q-gutter-xs">
              <button
                v-for="p in printings"
                :key="p.asset"
                class="printing"
                :class="{ 'printing--current': p.asset === card.asset }"
                type="button"
                @click="openCardDetail(p)"
              >
                <img :src="getCardImage(p.asset)" :alt="`${p.name} (${p.extension})`" loading="lazy" />
                <span>{{ (p.extension_short || '').toUpperCase() }}</span>
                <q-tooltip>{{ p.extension }}</q-tooltip>
              </button>
            </div>
          </div>
        </div>

        <!-- Everything printed on the card, then what you can do with it -->
        <div class="card-detail__info">
          <div class="card-detail__name">{{ card.name }}</div>
          <div class="card-detail__meta">
            <span class="type-badge" :class="`card-list-${card.type}`">{{ card.type }}</span>
            <ManySymbols :resources="card.resources" class="card-detail__symbols" />
          </div>
          <div v-if="card.keywords?.length" class="card-detail__keywords">{{ card.keywords.join(' · ') }}</div>

          <div v-if="stats.length" class="card-detail__stats">
            <div v-for="s in stats" :key="s.label" class="stat">
              <div class="stat__value">
                <ResourceSymbol v-if="s.zone" :element="s.zone" isAttackZone size="26px" />
                <template v-else>{{ s.value }}</template>
                <ResourceSymbol v-if="s.block" :element="s.block" isBlockSymbol size="30px" />
              </div>
              <div class="stat__label">{{ s.label }}</div>
            </div>
          </div>

          <div class="card-detail__text">
            <p v-for="(line, i) in shownText" :key="i">
              <b v-if="line.lead">{{ line.lead }}</b>{{ line.rest }}
            </p>
            <p v-if="!card.text" class="text-grey-6">No card text.</p>
          </div>
          <div v-if="card.text_original" class="card-detail__errata">
            <q-icon name="history_edu" />
            {{ showPrinted ? 'Showing the printed text, before errata.' : 'This card has errata.' }}
            <a href="#" @click.prevent="showPrinted = !showPrinted">
              {{ showPrinted ? 'Show current text' : 'Show printed text' }}
            </a>
          </div>

          <div class="card-detail__legality">
            <q-chip v-for="l in legality" :key="l.label" dense square outline
              :color="LEGALITY_COLOR[l.status]" :label="`${l.label}: ${l.status}`" />
            <q-chip v-if="card.formats?.includes('unreleased')" dense square color="orange" text-color="white" label="Unreleased" />
          </div>

          <div class="card-detail__set text-grey-7">
            {{ card.extension }}<template v-if="collectorNumber != null"> · #{{ collectorNumber }}</template>
            <template v-if="card.rarity"> · <span class="text-capitalize">{{ card.rarity }}</span></template>
          </div>

          <q-separator class="q-my-md" />

          <!-- Deck -->
          <div class="card-detail__deck">
            <template v-if="isCharacter">
              <q-chip v-if="isFace" icon="check" color="positive" text-color="white" label="Your deck's character" />
              <q-btn v-else unelevated no-caps color="primary" icon="person_add"
                :label="store.face ? 'Make this your character' : 'Start a deck with this character'"
                @click="store.setFace(card)" />
            </template>
            <template v-else>
              <span class="deck-label">Deck</span>
              <q-btn round dense flat icon="remove" :disable="!mainQty" @click="store.decrement(card)" />
              <span class="deck-qty">{{ mainQty }} / {{ limit }}</span>
              <q-btn round dense flat icon="add" :disable="mainQty >= limit" @click="store.increment(card)" />
              <span class="deck-label q-ml-md">Side</span>
              <q-btn round dense flat icon="remove" :disable="!sideQty" @click="store.decrementSide(card)" />
              <span class="deck-qty">{{ sideQty }}</span>
              <q-btn round dense flat icon="add" :disable="sideQty >= limit" @click="store.incrementSide(card)" />
            </template>
          </div>

          <!-- Links -->
          <div class="card-detail__links">
            <q-btn flat dense no-caps icon="search" label="Card browser" @click="browse" />
            <q-btn flat dense no-caps :icon="copied ? 'check' : 'link'" :label="copied ? 'Copied' : 'Copy link'" @click="copyLink" />
            <q-btn v-if="card.rochester_url" flat dense no-caps icon="shopping_cart" label="RochesterCCG"
              type="a" :href="'https://www.rochesterccg.com' + card.rochester_url" target="_blank" rel="noopener" />
          </div>
        </div>
      </div>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.card-detail {
  position: relative;
  width: 860px;
  max-width: 95vw;
  padding: 20px;
}
.card-detail__close {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  /* On phones it sits over the card art. */
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}
.card-detail__layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.card-detail__art {
  flex: 0 0 320px;
}
.card-detail__image {
  border-radius: 14px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
}
.card-detail__printings {
  margin-top: 12px;
}
.printing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 52px;
  padding: 2px;
  border: 2px solid transparent;
  border-radius: 6px;
  background: none;
  cursor: pointer;
  font-size: 10px;
  color: inherit;
}
.printing img {
  width: 100%;
  border-radius: 3px;
}
.printing:hover {
  border-color: rgba(0, 0, 0, 0.2);
}
.printing--current {
  border-color: var(--q-primary);
}

.card-detail__info {
  flex: 1 1 auto;
  min-width: 0;
}
.card-detail__name {
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.2;
  padding-right: 32px;
}
.card-detail__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}
.type-badge {
  padding: 2px 10px;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
/* Types with no .card-list-* colour. */
.type-badge.card-list-token,
.type-badge.card-list-arena {
  background-color: #6b7280;
}
.card-detail__symbols :deep(.q-icon) {
  font-size: 24px;
}
.card-detail__keywords {
  margin-top: 6px;
  font-style: italic;
  color: #555;
}
.card-detail__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.stat {
  min-width: 72px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.05);
  text-align: center;
}
.stat__value {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 30px;
  font-size: 22px;
  font-weight: 700;
}
.stat__label {
  font-size: 11px;
  color: #666;
  text-transform: capitalize;
}
.card-detail__text {
  margin-top: 14px;
  font-size: 15px;
  line-height: 1.45;
}
.card-detail__text p {
  margin: 0 0 8px;
}
.card-detail__errata {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #8a5a00;
}
.card-detail__legality {
  margin-top: 10px;
}
.card-detail__legality .q-chip {
  margin-left: 0;
  text-transform: capitalize;
}
.card-detail__set {
  margin-top: 6px;
  font-size: 13px;
}
.card-detail__deck {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
}
.deck-label {
  font-weight: 600;
  margin-right: 4px;
}
.deck-qty {
  min-width: 40px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.card-detail__links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 10px;
}

@media (max-width: 700px) {
  .card-detail {
    width: 100%;
    max-width: 100%;
    padding: 16px;
  }
  .card-detail__layout {
    flex-direction: column;
  }
  .card-detail__art {
    flex: none;
    width: 100%;
    max-width: 340px;
    align-self: center;
  }
}
</style>
