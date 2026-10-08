<script setup>
import { computed } from 'vue'
import ResourceSymbol from 'src/components/cards/detail/ResourceSymbol.vue'
import {
  EXCLUDED_SYMBOLS, baseSymbol, faceSymbolsOf, mainSymbolOf, isConfused, deckSymbolLabel,
} from 'src/js/deck_symbol'

// At-a-glance stats for a read-only decklist, shown under the face preview in
// DeckStage: symbols, card-type mix, size and average difficulty.
const props = defineProps({
  face: { type: Object, default: null },
  // Resolved main-deck cards ({ type, resources, difficulty, qty, ... }).
  cards: { type: Array, default: () => [] },
  // Precomputed main symbol (/lists, /majors index). Computed live when absent,
  // e.g. for precons.
  deckSymbol: { type: String, default: null },
})

// Same colors as the global .card-list-* row classes in src/css/app.sass.
const TYPE_COLORS = {
  attack: '#d25421',
  foundation: '#b6a7a0',
  action: '#0b64cf',
  asset: '#a3bf75',
  backup: '#7b3fa0',
}
const TYPE_ORDER = Object.keys(TYPE_COLORS)

const total = computed(() => props.cards.reduce((n, c) => n + (c.qty ?? 1), 0))

const mainSymbol = computed(() => props.deckSymbol ?? mainSymbolOf(props.face, props.cards))

// Copies carrying exactly this printed resource ("fire" and "fire-attuned"
// are counted separately).
const copiesWith = resource => props.cards.reduce((n, c) =>
  (c.resources ?? []).includes(resource) ? n + (c.qty ?? 1) : n, 0)

const cardsLabel = n => `${n} card${n === 1 ? '' : 's'}`
const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

const byCountDesc = (a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol)

// The symbols row, left to right: hard symbols, then attuned ones. With a
// known main symbol the hard part is just that one, highlighted. The main
// symbol itself comes from the stricter single-link rule in mainSymbolOf;
// the counts are only the readable "how much of the deck is X".
const hardChips = computed(() => {
  const main = mainSymbol.value
  if (main && !isConfused(main)) {
    return [{ symbol: main, count: copiesWith(main), main: true }]
  }
  // Mixed, or no single face to score against (multi-character precons): show
  // the hard symbols actually in play, none of them highlighted.
  const candidates = props.face
    ? faceSymbolsOf(props.face)
    : [...new Set(props.cards.flatMap(c => c.resources ?? []))]
      // Infinity is the wildcard, not a hard symbol. ("all" is a real one.)
      .filter(r => r === baseSymbol(r) && !EXCLUDED_SYMBOLS.has(r))
  return candidates
    .map(symbol => ({ symbol, count: copiesWith(symbol), main: false }))
    .filter(r => r.count > 0)
    .sort(byCountDesc)
})

const attunedChips = computed(() =>
  [...new Set(props.cards.flatMap(c => c.resources ?? []).filter(r => r !== baseSymbol(r)))]
    .map(resource => ({ symbol: baseSymbol(resource), resource, count: copiesWith(resource) }))
    .sort(byCountDesc))

const typeRows = computed(() => {
  const byType = new Map()
  for (const c of props.cards) {
    const t = c.type || 'unknown'
    byType.set(t, (byType.get(t) ?? 0) + (c.qty ?? 1))
  }
  const rank = t => { const i = TYPE_ORDER.indexOf(t); return i < 0 ? TYPE_ORDER.length : i }
  return [...byType]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([type, count]) => ({
      type,
      count,
      pct: total.value ? (count / total.value) * 100 : 0,
      color: TYPE_COLORS[type] ?? '#999999',
    }))
})

const avgDifficulty = computed(() => {
  let n = 0, sum = 0
  for (const c of props.cards) {
    if (typeof c.difficulty !== 'number') continue
    n += c.qty ?? 1
    sum += c.difficulty * (c.qty ?? 1)
  }
  return n ? (sum / n).toFixed(1) : null
})
</script>

<template>
  <div v-if="total" class="deck-summary">
    <!-- Separates the stats from the card name above, which belongs to
         whatever card is being previewed — not necessarily the face. -->
    <div class="deck-summary__divider" role="separator"><span>Deck</span></div>
    <div v-if="hardChips.length || attunedChips.length || isConfused(mainSymbol)"
      class="deck-summary__symbols">
      <span class="deck-summary__label">Symbols</span>
      <span v-if="isConfused(mainSymbol)" class="sym-chip sym-chip--main">
        <ResourceSymbol :element="mainSymbol" size="20px" />
        <span class="sym-chip__count">{{ deckSymbolLabel(mainSymbol) }}</span>
      </span>
      <span
        v-for="chip in hardChips"
        :key="chip.symbol"
        class="sym-chip"
        :class="{ 'sym-chip--main': chip.main }"
      >
        <ResourceSymbol :element="chip.symbol" size="20px" />
        <span class="sym-chip__count">{{ chip.count }}</span>
        <q-tooltip>{{ chip.main ? 'Main symbol ' + cap(chip.symbol) : cap(chip.symbol) }} with {{ cardsLabel(chip.count) }}</q-tooltip>
      </span>
      <span v-for="chip in attunedChips" :key="chip.resource" class="sym-chip">
        <ResourceSymbol :element="chip.resource" size="20px" />
        <span class="sym-chip__count">{{ chip.count }}</span>
        <q-tooltip>{{ cap(chip.symbol) }}-attuned with {{ cardsLabel(chip.count) }}</q-tooltip>
      </span>
    </div>

    <div class="type-bar">
      <div
        v-for="row in typeRows"
        :key="row.type"
        class="type-bar__seg"
        :style="{ width: `${row.pct}%`, background: row.color }"
      >
        <q-tooltip>{{ row.type }}: {{ row.count }} ({{ Math.round(row.pct) }}%)</q-tooltip>
      </div>
    </div>
    <div class="type-legend">
      <span v-for="row in typeRows" :key="row.type" class="type-legend__item">
        <span class="type-legend__dot" :style="{ background: row.color }" />
        <span class="type-legend__name">{{ row.type }}</span>
        <span class="type-legend__count">{{ row.count }}</span>
        <span class="type-legend__pct">{{ Math.round(row.pct) }}%</span>
      </span>
    </div>

    <div class="deck-summary__totals">
      {{ total }} cards
      <template v-if="avgDifficulty"> · avg difficulty {{ avgDifficulty }}</template>
    </div>
  </div>
</template>

<style scoped>
.deck-summary {
  width: 100%;
  max-width: 300px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.85);
}

.deck-summary__divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.45);
}
.deck-summary__divider::before,
.deck-summary__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
}

.deck-summary__symbols {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.deck-summary__label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.6;
  margin-right: 4px;
}
.sym-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px 2px 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  opacity: 0.55;
}
.sym-chip--main {
  opacity: 1;
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.1);
}
.sym-chip__count {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.type-bar {
  display: flex;
  height: 10px;
  border-radius: 5px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.1);
}
.type-bar__seg + .type-bar__seg {
  border-left: 1px solid rgba(0, 0, 0, 0.35);
}

.type-legend {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 12px;
}
.type-legend__item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.type-legend__dot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.type-legend__name {
  text-transform: capitalize;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.type-legend__count {
  margin-left: auto;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.type-legend__pct {
  width: 4ch;
  text-align: right;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}

.deck-summary__totals {
  opacity: 0.7;
}
</style>
