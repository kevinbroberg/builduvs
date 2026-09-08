<script setup>
import { ref, computed, watch } from "vue";

const SEAT_COLORS = [
  { name: "Blue", color: "blue", textColor: "white" },
  { name: "Red", color: "red", textColor: "white" },
  { name: "Green", color: "green", textColor: "white" },
  { name: "Yellow", color: "yellow", textColor: "black" },
  { name: "Purple", color: "purple", textColor: "white" },
  { name: "Orange", color: "orange", textColor: "black" },
  { name: "Teal", color: "teal", textColor: "white" },
  { name: "Pink", color: "pink", textColor: "white" },
  { name: "Indigo", color: "indigo", textColor: "white" },
  { name: "Lime", color: "lime", textColor: "black" },
  { name: "Cyan", color: "cyan", textColor: "black" },
  { name: "Brown", color: "brown", textColor: "white" },
  { name: "Amber", color: "amber", textColor: "black" },
  { name: "Deep Purple", color: "deep-purple", textColor: "white" },
  { name: "Deep Orange", color: "deep-orange", textColor: "white" },
  { name: "Light Blue", color: "light-blue", textColor: "black" },
  { name: "Light Green", color: "light-green", textColor: "black" },
  { name: "Blue Grey", color: "blue-grey", textColor: "white" },
  { name: "Grey", color: "grey", textColor: "black" },
  { name: "Black", color: "black", textColor: "white" },
];

const phase = ref("setup"); // "setup" | "shuffle" | "done"
const numPiles = ref(8);
const deckSize = ref(60);
const gridColsOverride = ref(null);

const currentRound = ref(0);
const rounds = ref([]); // each entry: { handSize, sequence }
const collectOrder = ref([]);

const totalRounds = computed(() => rounds.value.length);
const shufflesNeeded = computed(() =>
  Math.ceil(Math.log(deckSize.value) / Math.log(numPiles.value))
);
const seats = computed(() => SEAT_COLORS.slice(0, numPiles.value));

// The slider is a convenience control for the common 10–100 range, but the text
// input accepts any positive number (e.g. a 700-card cube). Grow the slider's max
// to match so a large typed value still shows a sensible thumb position.
const sliderMax = computed(() => Math.max(100, Number(deckSize.value) || 0));
const currentRoundData = computed(() => rounds.value[currentRound.value] || { handSize: 0, sequence: [] });

// seatIdx → 1-based deal position for the current round (undefined if skipped)
const dealRank = computed(() => {
  const rank = {};
  currentRoundData.value.sequence.slice(0, currentRoundData.value.handSize).forEach((seatIdx, i) => {
    rank[seatIdx] = i + 1;
  });
  return rank;
});

// exact-factor row×col shapes for the current pile count (e.g. 12 → 3×4, 4×3, 2×6...)
const gridShapeOptions = computed(() => {
  const n = numPiles.value;
  const shapes = [];
  for (let cols = 2; cols <= n; cols++) {
    if (n % cols === 0) shapes.push({ rows: n / cols, cols });
  }
  shapes.sort(
    (a, b) => Math.abs(a.rows - a.cols) - Math.abs(b.rows - b.cols) || a.cols - b.cols
  );
  return shapes;
});

// fall back to a 2-row-minimum layout when the pile count has no nice factors (e.g. primes)
const defaultGridShape = computed(
  () => gridShapeOptions.value[0] || { rows: 2, cols: Math.ceil(numPiles.value / 2) }
);

const gridCols = computed(() => gridColsOverride.value ?? defaultGridShape.value.cols);

watch(numPiles, () => {
  gridColsOverride.value = null;
});

// seatIdx → 1-based pickup position for the collect step
const collectRank = computed(() => {
  const rank = {};
  collectOrder.value.forEach((seatIdx, i) => {
    rank[seatIdx] = i + 1;
  });
  return rank;
});

function rankStyle(rank, total) {
  const t = total <= 1 ? 0 : (rank - 1) / (total - 1);
  return {
    fontSize: (2.6 - t * 1.4).toFixed(2) + "rem",
    opacity: (1.0 - t * 0.55).toFixed(2),
    fontWeight: 700,
    lineHeight: 1,
  };
}

function fisherYates(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startShuffle() {
  // The text input allows arbitrary entry, so normalize to a positive integer
  // (empty field / decimals) before dealing.
  deckSize.value = Math.max(1, Math.floor(Number(deckSize.value) || 0));

  const n = numPiles.value;
  const total = Math.ceil(deckSize.value / n);
  const q = Math.floor(deckSize.value / total);
  const r = deckSize.value - q * total; // r rounds deal q+1 cards, rest deal q
  const handSizes = fisherYates([
    ...Array(r).fill(q + 1),
    ...Array(total - r).fill(q),
  ]);
  const indices = Array.from({ length: n }, (_, i) => i);
  rounds.value = handSizes.map((handSize) => ({
    handSize,
    sequence: fisherYates(indices),
  }));
  collectOrder.value = fisherYates(indices);
  currentRound.value = 0;
  phase.value = "shuffle";
}

function nextRound() {
  if (currentRound.value < totalRounds.value - 1) {
    currentRound.value++;
  } else {
    phase.value = "collect";
  }
}

function restart() {
  phase.value = "setup";
  currentRound.value = 0;
  rounds.value = [];
}
</script>

<template>
  <q-page>
    <!-- SETUP -->
    <div
      v-if="phase === 'setup'"
      class="column items-center q-gutter-lg q-pa-md"
      style="max-width: 400px; margin: auto; padding-top: 2rem"
    >
      <div class="text-h5">Pile Shuffle Helper</div>
      <div class="text-body2 text-center text-grey-7">
        Set up your piles and deck size, then follow the card-dealing instructions
        one round at a time.
      </div>

      <q-card flat bordered class="full-width">
        <q-card-section class="q-gutter-md">
          <div>
            <div class="text-subtitle2 q-mb-sm">
              Number of piles: <strong>{{ numPiles }}</strong>
            </div>
            <q-slider
              v-model="numPiles"
              :min="2"
              :max="20"
              :step="1"
              snap
              label
              color="primary"
            />
          </div>
          <div v-if="gridShapeOptions.length">
            <div class="text-subtitle2 q-mb-sm">Grid shape:</div>
            <q-btn-toggle
              :model-value="gridCols"
              @update:model-value="(cols) => (gridColsOverride = cols)"
              spread
              no-caps
              toggle-color="primary"
              color="white"
              text-color="primary"
              :options="
                gridShapeOptions
                  .slice(0, 4)
                  .map((s) => ({ label: `${s.rows} × ${s.cols}`, value: s.cols }))
              "
            />
          </div>
          <div>
            <div class="text-subtitle2 q-mb-sm">Deck size:</div>
            <div class="row items-center q-gutter-sm">
              <q-slider
                v-model="deckSize"
                :min="10"
                :max="sliderMax"
                :step="1"
                snap
                label
                color="primary"
                class="col"
              />
              <q-input
                v-model.number="deckSize"
                type="number"
                dense
                outlined
                :min="1"
                style="width: 84px"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <div class="text-body2 text-center text-grey-7">
        To fairly randomize the deck, repeat this process
        <strong>{{ shufflesNeeded }}×</strong>.
      </div>

      <q-btn color="primary" size="lg" class="full-width" @click="startShuffle">
        Start Shuffling
      </q-btn>
    </div>

    <!-- SHUFFLE -->
    <div
      v-else-if="phase === 'shuffle'"
      class="column"
      style="height: calc(100vh - 50px)"
    >
      <div class="col column q-pa-md" style="overflow: hidden">
        <div class="row full-width items-center q-mb-md">
          <div class="text-h6">Round {{ currentRound + 1 }} of {{ totalRounds }}</div>
          <q-space />
          <q-btn flat dense icon="close" @click="restart" />
        </div>

        <q-linear-progress
          :value="currentRound / totalRounds"
          color="primary"
          class="q-mb-lg"
          style="height: 8px; border-radius: 4px"
        />

        <div class="text-subtitle2 text-grey-7 q-mb-sm">
          Deal {{ currentRoundData.handSize }} cards:
        </div>
        <div class="table-surface q-pa-sm" style="flex: 1; min-height: 0">
          <div class="table-grid" :style="{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }">
            <div
              v-for="(seat, idx) in seats"
              :key="seat.name"
              class="seat-tile"
              :class="dealRank[idx] === undefined ? 'seat-skipped' : 'bg-' + seat.color"
            >
              <div
                class="seat-number"
                :style="dealRank[idx] !== undefined
                  ? { color: seat.textColor, ...rankStyle(dealRank[idx], currentRoundData.handSize) }
                  : { opacity: 0.25 }"
              >
                {{ dealRank[idx] ?? '—' }}
              </div>
              <div
                class="seat-name"
                :style="{ color: dealRank[idx] !== undefined ? seat.textColor : 'inherit' }"
              >
                {{ seat.name }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <q-btn
        :color="currentRound < totalRounds - 1 ? 'primary' : 'positive'"
        :icon-right="currentRound < totalRounds - 1 ? 'chevron_right' : 'check'"
        :label="currentRound < totalRounds - 1 ? 'Next Round' : 'Done Dealing'"
        size="lg"
        square
        unelevated
        class="full-width"
        style="height: 56px; flex-shrink: 0"
        @click="nextRound"
      />
    </div>

    <!-- COLLECT -->
    <div
      v-else-if="phase === 'collect'"
      class="column"
      style="height: calc(100vh - 50px)"
    >
      <div class="col column q-pa-md" style="overflow: hidden">
        <div class="row full-width items-center q-mb-md">
          <div class="text-h6">Collect your piles</div>
          <q-space />
          <q-btn flat dense icon="close" @click="restart" />
        </div>

        <q-linear-progress
          :value="1"
          color="primary"
          class="q-mb-lg"
          style="height: 8px; border-radius: 4px"
        />

        <div class="text-subtitle2 text-grey-7 q-mb-sm">
          Pick up the piles:
        </div>
        <div class="table-surface q-pa-sm" style="flex: 1; min-height: 0">
          <div class="table-grid" :style="{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }">
            <div
              v-for="(seat, idx) in seats"
              :key="seat.name"
              class="seat-tile"
              :class="'bg-' + seat.color"
            >
              <div
                class="seat-number"
                :style="{ color: seat.textColor, ...rankStyle(collectRank[idx], seats.length) }"
              >
                {{ collectRank[idx] }}
              </div>
              <div class="seat-name" :style="{ color: seat.textColor }">
                {{ seat.name }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <q-btn
        color="positive"
        icon-right="check"
        label="Shuffle Complete"
        size="lg"
        square
        unelevated
        class="full-width"
        style="height: 56px; flex-shrink: 0"
        @click="phase = 'done'"
      />
    </div>

    <!-- DONE -->
    <div
      v-else
      class="column items-center q-gutter-lg q-pa-md"
      style="max-width: 400px; margin: auto; padding-top: 4rem"
    >
      <q-icon name="check_circle" color="positive" size="80px" />
      <div class="text-h5">Shuffle Complete!</div>
      <div class="text-body1 text-center text-grey-7">
        All {{ deckSize }} cards have been dealt across {{ numPiles }} piles. Collect
        them up!
      </div>
      <q-btn
        color="primary"
        size="lg"
        class="full-width"
        label="Shuffle Again"
        @click="startShuffle"
      />
      <q-btn flat color="grey" class="full-width" label="Change Settings" @click="restart" />
    </div>
  </q-page>
</template>

<style scoped>
.table-surface {
  background: #2d5a27;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.table-grid {
  flex: 1;
  display: grid;
  grid-auto-rows: 1fr;
  gap: 10px;
}

.seat-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px 8px 12px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.18);
}

.seat-number {
  font-weight: 700;
  line-height: 1;
  transition: font-size 0.2s, opacity 0.2s;
}

.seat-name {
  margin-top: 6px;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.85;
}
</style>
