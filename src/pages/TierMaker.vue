<script setup>
// Tier list maker. Setup picks which cards to rank (type + set) and the tiers
// themselves; the board then lists every in-scope card's avatar in an "unranked"
// tray at the bottom. Cards move by dragging (pointer events, so touch works too —
// see src/js/card_drag.js) or by right-clicking and choosing a tier. Shift/ctrl-click
// or a box drawn over empty space selects several, which then move as one; with a
// selection, clicking a tier sends it there. Each row has TierMaker-style settings
// (gear); board-wide actions live in the tray's header, beside a quick add for
// cards outside the selection. Setup lives at /tiers and the board at /tiers/rank,
// so links (the menu, a deck page's "Rank" — see tierLink in src/js/tier_file.js)
// land on setup and back/forward moves between the two.
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { cards, cardByAsset } from 'src/js/card_provider'
import { useCardDrag } from 'src/js/card_drag'
import { LABEL_PALETTE, ROW_PALETTE, textOn } from 'src/js/tier_colors'
import { useTiersStore, cardsFor, POOL, ALL_SETS, FORMAT_SETS } from 'src/stores/tiers'
import TierFace from 'src/components/tiers/TierFace.vue'
import TierLabel from 'src/components/tiers/TierLabel.vue'
import TierChip from 'src/components/tiers/TierChip.vue'
import PoolViewDialog from 'src/components/tiers/PoolViewDialog.vue'
import TierRowDialog from 'src/components/tiers/TierRowDialog.vue'
import EmojiPicker from 'src/components/tiers/EmojiPicker.vue'
import ColorSwatches from 'src/components/tiers/ColorSwatches.vue'
import TierQuickAdd from 'src/components/tiers/TierQuickAdd.vue'
import { defaultPoolView, applyPoolView, activeFilterCount, RARITY_ORDER } from 'src/js/tier_pool_view'
import {
  fromTierFile, fromTierData, toTierFile, downloadTierFile, LINK_CARDS, LINK_TITLE,
} from 'src/js/tier_file'

const store = useTiersStore()
const { criteria, tiers, placements, title, rowColor, viewMode } = storeToRefs(store)
const $q = useQuasar()
const route = useRoute()
const router = useRouter()

const SETUP_PATH = '/tiers'
const RANK_PATH = '/tiers/rank'
const ranking = computed(() => route.path === RANK_PATH)

// ----- setup ------------------------------------------------------------------

const typeOptions = [...new Set(cards.map(c => c.type))].sort()

// The set picker lists sets newest first, under a few "every set in <format>" rows.
// Those rows are options with a reserved prefix; picking one replaces the selection
// with the format's sets rather than landing in it.
const FORMAT_OPTION = 'format:'
const formatOptions = Object.keys(FORMAT_SETS).map(name => FORMAT_OPTION + name)
const isFormatOption = (opt) => opt.startsWith(FORMAT_OPTION)
const formatName = (opt) => opt.slice(FORMAT_OPTION.length)

const setNeedle = ref('')
const setOptions = computed(() => {
  const needle = setNeedle.value.toLowerCase()
  const match = (text) => !needle || text.toLowerCase().includes(needle)
  return [...formatOptions.filter(o => match(formatName(o))), ...ALL_SETS.filter(match)]
})
function filterSets(val, update) {
  update(() => { setNeedle.value = val })
}
function onSetsPicked(value) {
  value ??= []                              // the clear button sends null
  const format = value.find(isFormatOption)
  criteria.value.sets = format ? [...FORMAT_SETS[formatName(format)]] : value
}
// A format row reads as ticked when the selection is exactly that format's sets.
function isFormatActive(opt) {
  const sets = FORMAT_SETS[formatName(opt)]
  return sets.length === criteria.value.sets.length && sets.every(x => criteria.value.sets.includes(x))
}
const activeFormat = computed(() => formatOptions.find(isFormatActive))

// Dozens of set chips would push the page down; show a few and count the rest.
const SET_CHIPS = 5
function removeSet(name) {
  criteria.value.sets = criteria.value.sets.filter(x => x !== name)
}

// Saves from before the rarity filter (or hand-picked lists) existed lack these.
criteria.value.rarities ??= []
criteria.value.cards ??= null
criteria.value.extra ??= []

// Rarities present among the chosen types and sets, in rarity order.
const rarityOptions = computed(() => {
  const types = new Set(criteria.value.types)
  const sets = new Set(criteria.value.sets)
  const seen = new Set(cards.filter(c => types.has(c.type) && sets.has(c.extension)).map(c => c.rarity))
  const rank = (r) => (RARITY_ORDER.includes(r) ? RARITY_ORDER.indexOf(r) : RARITY_ORDER.length)
  return [...seen].filter(Boolean).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
})

const inScope = computed(() => cardsFor(criteria.value))

const hasPlacements = computed(() =>
  Object.values(placements.value).some(list => list.length))

// The board needs something to rank and somewhere to put it; a bookmarked or
// reloaded /tiers/rank without either goes back to setup.
const canRank = computed(() => inScope.value.length > 0 && tiers.value.length > 0)
watch(ranking, (on) => {
  if (!on) return
  if (canRank.value) store.start()
  else router.replace(SETUP_PATH)
}, { immediate: true })

// Labels take Discord-style :emoji: codes; the picker just appends one.
function addEmoji(tier, name) {
  tier.label = `${tier.label.trimEnd()} :${name}:`.trimStart()
}

// ----- ranking board ----------------------------------------------------------

const pool = computed(() => {
  const placed = new Set(Object.values(placements.value).flat())
  return inScope.value.filter(c => !placed.has(c.asset))
})

// What the tray actually shows. Session-only on purpose: not worth persisting.
const poolView = ref(defaultPoolView())
const poolViewOpen = ref(false)
const shownPool = computed(() => applyPoolView(pool.value, poolView.value))
const poolFilterCount = computed(() => activeFilterCount(poolView.value))
const poolViewChanged = computed(() =>
  poolFilterCount.value > 0 || poolView.value.sort !== 'set' || poolView.value.desc)

const tierCards = (id) => (placements.value[id] || []).map(a => cardByAsset.get(a)).filter(Boolean)

// Round faces, square art, or whole cards; chosen on the setup page, where each
// option previews a card from the current selection.
const VIEW_MODES = [
  { value: 'avatar', label: 'Avatars' },
  { value: 'art', label: 'Art' },
  { value: 'card', label: 'Full cards' },
]
const sampleCard = computed(() => inScope.value[0] ?? cards.find(c => c.type === 'character'))

// The background behind a tier's cards: its own, else the board's, else the theme's.
const rowBackground = (tier) => tier.rowColor ?? rowColor.value ?? undefined

// Row settings dialog (the gear on each row).
const rowSettingsId = ref(null)
const rowSettingsOpen = ref(false)
function openRowSettings(id) {
  rowSettingsId.value = id
  rowSettingsOpen.value = true
}

// Tray-header buttons drop their text on narrow screens.
const wide = computed(() => $q.screen.gt.sm)

// ----- selection --------------------------------------------------------------

const selection = ref(new Set())

// Every visible card, top tier to tray. A group move keeps this order, and cards
// the tray filter hides drop out of the selection's reach.
const displayOrder = computed(() => [
  ...tiers.value.flatMap(t => placements.value[t.id] || []),
  ...shownPool.value.map(c => c.asset),
])
const selectedInOrder = computed(() => displayOrder.value.filter(a => selection.value.has(a)))
const isSelected = (asset) => selection.value.has(asset)

function clearSelection() {
  if (selection.value.size) selection.value = new Set()
}
function toggleSelected(asset) {
  const next = new Set(selection.value)
  if (!next.delete(asset)) next.add(asset)
  selection.value = next
}

// A selected card speaks for the whole selection; any other card just for itself.
const movingFor = (asset) => (isSelected(asset) ? selectedInOrder.value : [asset])

function send(asset, to, index = null) {
  const wasSelected = isSelected(asset)
  store.move(movingFor(asset), to ?? POOL, index)
  if (wasSelected) clearSelection()
}

// Right-click destinations. A lone card skips the tier it's already in; a group may
// span tiers, so it gets them all.
function menuFor(asset, zone) {
  const count = movingFor(asset).length
  return {
    count,
    targets: count > 1 ? tiers.value : tiers.value.filter(t => t.id !== zone),
    canUnrank: count > 1 || zone !== POOL,
  }
}

// Shift/ctrl/cmd-click toggles; a tap on a touchscreen toggles too, since there's no
// shift key there. A plain click selects just that card, or clears it if it already was.
function onChipClick(evt, asset) {
  if (drag.suppressClick.value) { drag.suppressClick.value = false; return }
  if (evt.shiftKey || evt.ctrlKey || evt.metaKey || evt.pointerType === 'touch') {
    toggleSelected(asset)
  } else if (selection.value.size === 1 && isSelected(asset)) {
    clearSelection()
  } else {
    selection.value = new Set([asset])
  }
}

// Box select: a mouse press on empty board space draws a rectangle, and every avatar
// it touches is selected (added to the selection with shift/ctrl held). Mouse only:
// on touch, a drag over empty space should scroll.
const marquee = ref(null)
let box = null

function onBoardPointerDown(evt) {
  if (evt.button !== 0 || evt.pointerType !== 'mouse') return
  if (evt.target.closest('.tier-chip, button, .q-btn, input, a, .q-field')) return
  // A press on a scrollbar belongs to the scrollbar.
  if (evt.target.clientWidth && evt.offsetX > evt.target.clientWidth) return
  const additive = evt.shiftKey || evt.ctrlKey || evt.metaKey
  box = {
    x: evt.clientX, y: evt.clientY, additive, base: additive ? selection.value : new Set(), moved: false,
    // Where a plain click (no box) would send the selection.
    target: evt.target.closest('.tm-tier')?.dataset.tierId ?? (evt.target.closest('.tm-pool') ? POOL : null),
  }
  window.addEventListener('pointermove', onBoxMove)
  window.addEventListener('pointerup', onBoxEnd)
  window.addEventListener('pointercancel', onBoxEnd)
}

const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

function onBoxMove(evt) {
  if (!box) return
  if (!box.moved && Math.hypot(evt.clientX - box.x, evt.clientY - box.y) < 4) return
  box.moved = true
  const rect = {
    left: Math.min(box.x, evt.clientX), right: Math.max(box.x, evt.clientX),
    top: Math.min(box.y, evt.clientY), bottom: Math.max(box.y, evt.clientY),
  }
  marquee.value = rect
  // Tray cards scrolled out of view still have rects (behind the tiers); only count
  // the part of the tray that's actually showing.
  const trayRect = document.querySelector('.tm-pool')?.getBoundingClientRect()
  const next = new Set(box.base)
  for (const el of document.querySelectorAll('.tm-board [data-asset]')) {
    const r = el.querySelector('[data-face]')?.getBoundingClientRect()
    if (!r || !overlaps(r, rect)) continue
    if (trayRect && el.closest('.tm-pool') && !overlaps(r, trayRect)) continue
    next.add(el.dataset.asset)
  }
  selection.value = next
}

function onBoxEnd() {
  if (box && !box.moved && !box.additive) {
    // A click on a tier (or the tray) with cards selected sends them there.
    if (box.target && selectedInOrder.value.length) store.move(selectedInOrder.value, box.target)
    clearSelection()
  }
  box = null
  marquee.value = null
  window.removeEventListener('pointermove', onBoxMove)
  window.removeEventListener('pointerup', onBoxEnd)
  window.removeEventListener('pointercancel', onBoxEnd)
}

// Everything the tray currently shows, i.e. "select all" under the active filters.
function selectShown() {
  selection.value = new Set(shownPool.value.map(c => c.asset))
}

function onKeydown(evt) {
  if (evt.key === 'Escape') clearSelection()
  // Ctrl/Cmd+A selects the tray, unless you're typing somewhere or a dialog is up.
  if (ranking.value && (evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === 'a'
    && !evt.target.closest?.('input, textarea, [contenteditable], .q-dialog')) {
    evt.preventDefault()
    selectShown()
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  onBoxEnd()
})

// ----- quick add ------------------------------------------------------------------

// The quick add offers one printing per name, so a card already on the board is
// matched by name and just found; anything else joins the list, unranked. Either
// way it ends up selected and scrolled to, so one click on a tier sends it.
const quickAddNote = ref('')
let noteTimer = null
function note(text) {
  quickAddNote.value = text
  clearTimeout(noteTimer)
  noteTimer = setTimeout(() => { quickAddNote.value = '' }, 2500)
}
const plainLabel = (tier) => tier.label.replace(/:[\w+-]+:/g, '').trim() || 'a tier'

function onQuickAdd(card) {
  const existing = inScope.value.find(c => c.name === card.name)
  const asset = existing?.asset ?? card.asset
  if (!existing) store.addCard(asset)
  selection.value = new Set([asset])
  const tier = tiers.value.find(t => placements.value[t.id]?.includes(asset))
  if (tier) note(`${shortName(card)} is already in ${plainLabel(tier)}`)
  else if (!applyPoolView([cardByAsset.get(asset)], poolView.value).length) {
    note(`${existing ? '' : 'Added · '}hidden by the tray's filters`)
  } else if (existing) note(`${shortName(card)} is already unranked`)
  nextTick(() => document.querySelector(`.tm-board [data-asset="${CSS.escape(asset)}"]`)
    ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
}

// Cards quick-added on top of the filters, for the setup page.
const extraCount = computed(() => (criteria.value.cards ? 0 : criteria.value.extra.length))

// ----- dragging -----------------------------------------------------------------

const drag = useCardDrag({
  onDrop: (inst, zone, index) => send(inst.asset, zone, index),
})
const hovering = (zone) => drag.dragging.value && drag.hoverZone.value === zone

// What the current drag carries, and the first few of it for the ghost, with the
// card under the pointer on top.
const dragMoving = computed(() =>
  drag.dragging.value && drag.dragInst.value ? movingFor(drag.dragInst.value.asset) : [])
const ghostCards = computed(() => {
  const lead = drag.dragInst.value?.asset
  if (!lead || !dragMoving.value.length) return []
  return [lead, ...dragMoving.value.filter(a => a !== lead)].slice(0, 3)
    .map(a => cardByAsset.get(a)).reverse()
})

const shortName = (card) => card.name.split(',')[0]

const copied = ref(false)
async function copyAsText() {
  const lines = tiers.value.map(t =>
    `${t.label}: ${tierCards(t.id).map(shortName).join(', ') || '—'}`)
  if (title.value.trim()) lines.unshift(`**${title.value.trim()}**`)
  if (pool.value.length) lines.push(`Unranked: ${pool.value.map(shortName).join(', ')}`)
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch { /* clipboard blocked; nothing useful to fall back to */ }
}

// ----- import / export ------------------------------------------------------------

const exportJson = () => downloadTierFile(store.$state)

const fileInput = ref(null)
async function onFilePicked(evt) {
  const file = evt.target.files?.[0]
  evt.target.value = ''                     // so picking the same file again still fires
  if (!file) return
  let parsed
  try {
    parsed = fromTierFile(await file.text())
  } catch (e) {
    $q.dialog({ title: "Couldn't import", message: e.message })
    return
  }
  // A file is usually a finished (or half-finished) list, so it opens on the board.
  offerLoad(parsed, `Importing "${parsed.state.title || file.name}"`, () => router.push(RANK_PATH))
}

// A deck page's "Rank" link: /tiers?cards=<uvs ids>&title=<deck name>. It keeps
// this list's tiers and look and swaps in the deck's cards, all unranked, then
// leaves you on setup to look it over. The query comes off the URL once read, so
// a reload doesn't offer the swap again.
function loadFromLink() {
  const refs = String(route.query[LINK_CARDS] ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (!refs.length) return
  const linkTitle = String(route.query[LINK_TITLE] ?? '')
  router.replace(SETUP_PATH)
  let parsed
  try {
    parsed = fromTierData({
      ...toTierFile(store.$state), title: linkTitle, cards: refs, placements: {},
    })
  } catch (e) {
    $q.dialog({ title: "Couldn't open that deck", message: e.message })
    return
  }
  offerLoad(parsed, `Opening "${linkTitle || 'this deck'}"`)
}
watch(() => route.query[LINK_CARDS], loadFromLink, { immediate: true })

// Load imported state, asking first if it would throw away rankings.
function offerLoad({ state, unresolved }, what, then = () => {}) {
  const load = () => {
    store.load(state)
    then()
    if (unresolved.length) {
      $q.dialog({
        title: `${unresolved.length} card${unresolved.length === 1 ? '' : 's'} not found`,
        message: `These didn't match any card and were skipped: ${unresolved.join(', ')}`,
      })
    }
  }
  if (!hasPlacements.value) return load()
  $q.dialog({
    title: 'Replace this tier list?',
    message: `${what} replaces your current list and its rankings.`,
    cancel: true,
    ok: { label: 'Replace', color: 'negative', flat: true },
  }).onOk(load)
}
</script>

<template>
  <q-page class="tm-page">
    <!-- SETUP ----------------------------------------------------------------->
    <div v-if="!ranking" class="tm-setup q-pa-md q-gutter-y-md">
      <div class="row items-center">
        <div class="text-h5 col">Tier Maker</div>
        <q-btn flat dense no-caps icon="file_upload" label="Import" title="Import a tier list (.json)"
          @click="fileInput.click()" />
        <q-btn flat dense no-caps icon="file_download" label="Export" title="Save this tier list as .json"
          class="q-ml-sm" @click="exportJson" />
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onFilePicked">
      </div>

      <q-input v-model="title" outlined dense label="Title" placeholder="Untitled tier list" />

      <q-btn unelevated color="primary" class="full-width" size="lg"
        :label="hasPlacements ? 'Resume ranking' : 'Start ranking'"
        :disable="!canRank" :to="RANK_PATH" />

      <q-card flat bordered>
        <q-card-section class="q-gutter-y-sm">
          <div class="text-subtitle1">What to rank</div>
          <!-- An imported card list stands in for the filters until it's dropped. -->
          <div v-if="criteria.cards" class="row items-center no-wrap">
            <q-icon name="playlist_add_check" size="sm" color="primary" class="q-mr-sm" />
            <div class="col">Custom card list</div>
            <q-btn flat dense no-caps size="sm" label="Use filters instead" @click="criteria.cards = null" />
          </div>
          <template v-else>
            <q-select v-model="criteria.types" :options="typeOptions" label="Card types"
              multiple use-chips outlined dense options-dense />
            <q-select :model-value="criteria.sets" :options="setOptions" label="Sets"
              multiple use-chips use-input input-debounce="0" outlined dense options-dense clearable
              @update:model-value="onSetsPicked" @clear="criteria.sets = []" @filter="filterSets">
              <template #selected>
                <q-chip v-if="activeFormat" dense removable @remove="criteria.sets = []">
                  Every {{ formatName(activeFormat) }} set ({{ criteria.sets.length }})
                </q-chip>
                <template v-else>
                  <q-chip v-for="name in criteria.sets.slice(0, SET_CHIPS)" :key="name" dense removable
                    @remove="removeSet(name)">{{ name }}</q-chip>
                  <q-chip v-if="criteria.sets.length > SET_CHIPS" dense>
                    +{{ criteria.sets.length - SET_CHIPS }} more
                  </q-chip>
                </template>
              </template>
              <template #option="{ opt, itemProps }">
                <q-item v-if="isFormatOption(opt)" v-bind="itemProps" class="tm-format-option"
                  :class="{ 'tm-format-option--last': opt === formatOptions[formatOptions.length - 1] }">
                  <q-item-section avatar>
                    <q-icon :name="isFormatActive(opt) ? 'check_circle' : 'select_all'"
                      :color="isFormatActive(opt) ? 'primary' : 'grey-7'" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>Every {{ formatName(opt) }} set</q-item-label>
                    <q-item-label caption>{{ FORMAT_SETS[formatName(opt)].length }} sets</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item v-else v-bind="itemProps">
                  <q-item-section>{{ opt }}</q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-select v-model="criteria.rarities" :options="rarityOptions" label="Rarity"
              multiple use-chips outlined dense options-dense clearable
              hint="Leave empty for any rarity" @clear="criteria.rarities = []" />
            <div v-if="extraCount" class="row items-center no-wrap">
              <q-icon name="add_circle_outline" size="sm" color="primary" class="q-mr-sm" />
              <div class="col">Plus {{ extraCount }} quick-added card{{ extraCount === 1 ? '' : 's' }}</div>
              <q-btn flat dense no-caps size="sm" label="Remove" @click="criteria.extra = []" />
            </div>
          </template>
          <div class="text-caption text-grey-7">
            {{ inScope.length }} card{{ inScope.length === 1 ? '' : 's' }} to rank
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered>
        <q-card-section class="q-gutter-y-sm">
          <div class="row items-center">
            <div class="text-subtitle1 col">Tiers</div>
            <q-btn flat dense no-caps size="sm" label="Reset to defaults" @click="store.resetTiers()" />
          </div>
          <div v-for="(tier, i) in tiers" :key="tier.id" class="row items-center no-wrap q-gutter-x-sm">
            <!-- The label as the board will draw it, live; click to recolor. -->
            <button type="button" class="tm-label-preview" title="Change color"
              :style="{ background: tier.color, color: textOn(tier.color) }">
              <TierLabel :label="tier.label" jumbo />
              <q-icon name="palette" size="12px" class="tm-label-preview__hint" />
              <q-popup-proxy>
                <q-color v-model="tier.color" no-header-tabs default-view="palette"
                  :palette="LABEL_PALETTE" />
              </q-popup-proxy>
            </button>
            <q-input v-model="tier.label" dense outlined class="col">
              <template #append><EmojiPicker @pick="name => addEmoji(tier, name)" /></template>
            </q-input>
            <q-btn flat round dense size="sm" icon="arrow_upward" :disable="i === 0"
              @click="store.moveTier(tier.id, -1)" />
            <q-btn flat round dense size="sm" icon="arrow_downward" :disable="i === tiers.length - 1"
              @click="store.moveTier(tier.id, 1)" />
            <q-btn flat round dense size="sm" icon="delete" :disable="tiers.length <= 1"
              @click="store.removeTier(tier.id)" />
          </div>
          <q-btn flat dense no-caps icon="add" label="Add tier" color="primary" @click="store.addTier()" />
        </q-card-section>
      </q-card>

      <q-card flat bordered>
        <q-card-section>
          <div class="text-subtitle1 q-mb-sm">Card display</div>
          <div class="tm-modes">
            <button v-for="m in VIEW_MODES" :key="m.value" type="button" class="tm-mode"
              :class="{ 'tm-mode--on': viewMode === m.value }" :aria-pressed="viewMode === m.value"
              @click="viewMode = m.value">
              <TierFace v-if="sampleCard" :card="sampleCard" :mode="m.value" class="tm-mode__face" />
              <span class="tm-mode__label">{{ m.label }}</span>
            </button>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- RANKING --------------------------------------------------------------->
    <div v-else class="tm-board" @pointerdown="onBoardPointerDown"
      :class="{ 'tm-board--armed': selectedInOrder.length }">
      <!-- Title, plus what acts on the board as a whole -->
      <div class="tm-title row items-center no-wrap q-px-md q-pt-sm">
        <q-input v-model="title" borderless dense placeholder="Untitled tier list" class="col"
          input-class="tm-title__input" />
        <q-chip v-if="selectedInOrder.length" dense removable color="primary" text-color="white"
          @remove="clearSelection">{{ selectedInOrder.length }} selected</q-chip>
        <q-btn flat dense no-caps icon="format_color_fill" :label="wide ? 'Background' : undefined"
          title="Row background">
          <q-popup-proxy>
            <q-card class="q-pa-md" style="max-width: 300px">
              <div class="text-caption text-grey-7 q-mb-sm">Background behind every row's cards</div>
              <ColorSwatches v-model="rowColor" :palette="ROW_PALETTE" allow-default default-label="Theme default" />
            </q-card>
          </q-popup-proxy>
        </q-btn>
      </div>

      <div class="tm-tiers">
        <div v-for="(tier, i) in tiers" :key="tier.id" class="tm-tier" :data-tier-id="tier.id">
          <div class="tm-tier__label" :style="{ background: tier.color, color: textOn(tier.color) }">
            <TierLabel :label="tier.label" jumbo />
          </div>
          <div class="tm-tier__cards" :data-drop-zone="tier.id" :style="{ background: rowBackground(tier) }"
            :class="{ 'tm-zone--hover': hovering(tier.id) }">
            <TierChip v-for="card in tierCards(tier.id)" :key="card.asset" :card="card"
              :mode="viewMode" :selected="isSelected(card.asset)" :lifted="dragMoving.includes(card.asset)"
              v-bind="{ ...menuFor(card.asset, tier.id), ...drag.handlers({ asset: card.asset, zone: tier.id }) }"
              @click="onChipClick($event, card.asset)" @send="to => send(card.asset, to)" />
          </div>
          <div class="tm-tier__controls">
            <q-btn flat round dense size="sm" icon="settings" title="Row settings"
              @click="openRowSettings(tier.id)" />
            <q-btn flat round dense size="xs" icon="keyboard_arrow_up" title="Move row up"
              :disable="i === 0" @click="store.moveTier(tier.id, -1)" />
            <q-btn flat round dense size="xs" icon="keyboard_arrow_down" title="Move row down"
              :disable="i === tiers.length - 1" @click="store.moveTier(tier.id, 1)" />
          </div>
        </div>
        <q-btn flat dense no-caps icon="add" label="Add row" color="primary"
          class="q-mt-xs" @click="store.addTier()" />
      </div>

      <!-- The tray sticks to the bottom so tiers stay reachable while dragging out of a long pool. -->
      <div class="tm-pool">
        <div class="tm-pool__head text-caption">
          <span>
            Unranked ·
            <template v-if="shownPool.length !== pool.length">{{ shownPool.length }} of </template>{{ pool.length }}
          </span>
          <TierQuickAdd class="q-ml-sm" @pick="onQuickAdd" />
          <span v-if="quickAddNote" class="tm-pool__hint text-grey-7 q-ml-sm">{{ quickAddNote }}</span>
          <span v-else class="tm-pool__hint text-grey-6 q-ml-sm gt-sm">
            drag or right-click to send · shift-click or drag a box to select, then click a tier
          </span>
          <q-space />
          <q-btn v-if="poolViewChanged" flat dense no-caps size="sm" label="Clear"
            @click="poolView = defaultPoolView()" />
          <q-btn flat dense no-caps size="sm" icon="filter_list" label="Sort & filter"
            :color="poolViewChanged ? 'primary' : undefined" @click="poolViewOpen = true">
            <q-badge v-if="poolFilterCount" floating rounded color="primary">{{ poolFilterCount }}</q-badge>
          </q-btn>
          <q-btn flat dense no-caps size="sm" icon="tune" :label="wide ? 'Edit setup' : undefined"
            title="Edit setup" :to="SETUP_PATH" />
          <q-btn flat dense no-caps size="sm" :icon="copied ? 'check' : 'content_copy'" title="Copy as text"
            :label="wide ? (copied ? 'Copied' : 'Copy as text') : undefined" @click="copyAsText" />
          <q-btn flat dense no-caps size="sm" icon="file_download" title="Save this tier list as .json"
            :label="wide ? 'Export' : undefined" @click="exportJson" />
          <q-btn flat dense no-caps size="sm" icon="restart_alt" :label="wide ? 'Unrank all' : undefined"
            title="Unrank all" @click="store.clearPlacements()" />
        </div>
        <div class="tm-pool__cards" :data-drop-zone="POOL"
          :class="{ 'tm-zone--hover': hovering(POOL) && drag.dragInst.value?.zone !== POOL }">
          <TierChip v-for="card in shownPool" :key="card.asset" :card="card"
            :mode="viewMode" :selected="isSelected(card.asset)" :lifted="dragMoving.includes(card.asset)"
            v-bind="{ ...menuFor(card.asset, POOL), ...drag.handlers({ asset: card.asset, zone: POOL }) }"
            @click="onChipClick($event, card.asset)" @send="to => send(card.asset, to)" />
          <div v-if="!pool.length" class="tm-empty">Everything's ranked.</div>
          <div v-else-if="!shownPool.length" class="tm-empty">No unranked cards match the filters.</div>
        </div>
      </div>

      <TierRowDialog v-model:open="rowSettingsOpen" :tier-id="rowSettingsId" />

      <PoolViewDialog v-model:open="poolViewOpen" v-model:view="poolView" :cards="inScope"
        :shown-count="shownPool.length" @select-shown="selectShown" />

      <!-- Drag ghost: follows the pointer, never intercepts hit-testing -->
      <div v-if="ghostCards.length" class="tm-ghost" :style="drag.ghostStyle.value">
        <TierFace v-for="(card, i) in ghostCards" :key="card.asset" :card="card" :mode="viewMode"
          :show-name="i === ghostCards.length - 1" class="tm-ghost__card"
          :style="{ '--stack': ghostCards.length - 1 - i }" />
        <q-badge v-if="dragMoving.length > 1" floating rounded color="primary" class="tm-ghost__count">
          {{ dragMoving.length }}
        </q-badge>
      </div>

      <div v-if="marquee" class="tm-marquee" :style="{
        left: `${marquee.left}px`, top: `${marquee.top}px`,
        width: `${marquee.right - marquee.left}px`, height: `${marquee.bottom - marquee.top}px`,
      }" />
    </div>
  </q-page>
</template>

<style scoped>
.tm-setup {
  max-width: 560px;
  margin: 0 auto;
}

.tm-board {
  display: flex;
  flex-direction: column;
  min-height: inherit;
  user-select: none; /* shift-click and box select shouldn't highlight text */
}
/* A grey board, so the gaps between rows (and light row colors) don't wash out
   into a white page. */
body.body--light .tm-board { background: #dcdcdc; }
body.body--dark .tm-board { background: #2a2a2a; }
.tm-tiers {
  flex: 1;
  padding: 0 8px 8px;
}
.tm-tier {
  display: flex;
  min-height: 96px;
  margin-bottom: 4px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(127, 127, 127, 0.08);
}
.tm-tier__controls {
  flex: none;
  width: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
/* With cards selected, a tier is a click target. */
.tm-board--armed .tm-tier { cursor: pointer; }
.tm-board--armed .tm-tier:hover { box-shadow: 0 0 0 2px #1976d2; }
.tm-tier__label {
  flex: none;
  width: 104px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  text-align: center;
  font-weight: 700;
  font-size: 1.15rem;
  overflow-wrap: anywhere;
}
.tm-tier__cards,
.tm-pool__cards {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 4px 10px;
  padding: 4px 8px 8px;
  transition: background 0.12s;
}
/* An inset shadow rather than a background, so it shows over a row's own color. */
.tm-zone--hover {
  box-shadow: inset 0 0 0 100vmax rgba(25, 118, 210, 0.18);
}

.tm-pool {
  border-top: 2px solid rgba(127, 127, 127, 0.35);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.12);
  position: sticky;
  bottom: 0;
  max-height: 40vh;
  overflow-y: auto;
}
body.body--light .tm-pool { background: #fafafa; }
body.body--dark .tm-pool { background: #1d1d1d; }
.tm-pool__head {
  display: flex;
  align-items: center;
  gap: 4px;
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 4px 12px;
  background: inherit;
  font-weight: 600;
}
.tm-pool__cards { min-height: 96px; }

/* Same look as .tm-tier__label on the board, at setup-row size. */
/* "Every <format> set" rows sit above the set list, ruled off from it. */
.tm-format-option--last {
  border-bottom: 1px solid rgba(127, 127, 127, 0.3);
}

.tm-label-preview {
  position: relative;
  flex: none;
  width: 104px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px;
  border: 0;
  border-radius: 6px;
  font: inherit;
  font-weight: 700;
  font-size: 0.95rem;
  line-height: 1.2;
  text-align: center;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.tm-label-preview__hint {
  position: absolute;
  right: 3px;
  bottom: 3px;
  opacity: 0;
  transition: opacity 0.12s;
}
.tm-label-preview:hover .tm-label-preview__hint,
.tm-label-preview:focus-visible .tm-label-preview__hint {
  opacity: 0.8;
}

.tm-empty {
  padding: 24px;
  opacity: 0.6;
}

.tm-ghost {
  position: fixed;
  z-index: 9000;
  display: grid;
  pointer-events: none; /* so elementFromPoint sees the zone, not the ghost */
  transform: translate(-50%, -60%) rotate(-4deg);
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.35));
}
/* A group drag fans the first few cards out behind the one under the pointer. */
.tm-ghost .tm-ghost__card {
  grid-area: 1 / 1;
  transform: translate(calc(var(--stack) * 8px), calc(var(--stack) * 6px));
}
.tm-ghost__count {
  font-size: 13px;
  padding: 3px 7px;
}

.tm-title :deep(.tm-title__input),
.tm-title__input {
  font-size: 1.5rem;
  font-weight: 600;
}
.tm-pool__hint {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  min-width: 0;
}

/* Card display choices on the setup page: each one is its own live example. */
.tm-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.tm-mode {
  flex: 1 1 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 10px 8px 8px;
  border: 2px solid rgba(127, 127, 127, 0.3);
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.06);
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.tm-mode:hover { border-color: rgba(25, 118, 210, 0.5); }
.tm-mode--on {
  border-color: #1976d2;
  background: rgba(25, 118, 210, 0.08);
}
.tm-mode__face { pointer-events: none; }
.tm-mode__label { font-weight: 600; }

.tm-marquee {
  position: fixed;
  z-index: 8999;
  pointer-events: none;
  border: 1px solid #1976d2;
  background: rgba(25, 118, 210, 0.12);
}
</style>
