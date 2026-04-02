<script setup>
import { ref, computed } from "vue";
import rotationData from "src/assets/rewards-rotations.json";

const HISTORY_WEEKS = 8;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

const sortMode = ref("overdue"); // "overdue" | "alpha" | "recent"

// Parse rotation dates once, sorted newest-first
const sortedRotations = rotationData.rotations
  .map((r) => ({ ...r, date: new Date(r.week) }))
  .sort((a, b) => b.date - a.date);

// The N most recent weeks (for history dots)
const historySlice = sortedRotations.slice(0, HISTORY_WEEKS);

function getItemData(item) {
  const lastRotation = sortedRotations.find((r) => r.items.includes(item.id));
  const lastSeenDate = lastRotation ? lastRotation.date : null;

  let weeksSinceSeen = null;
  if (lastSeenDate) {
    weeksSinceSeen = Math.floor((Date.now() - lastSeenDate.getTime()) / MS_PER_WEEK);
  }

  const historyDots = historySlice.map((r) => r.items.includes(item.id));

  return { ...item, lastSeenDate, weeksSinceSeen, historyDots };
}

const enrichedItems = rotationData.items.map(getItemData);

const sortedItems = computed(() => {
  const items = [...enrichedItems];
  if (sortMode.value === "alpha") {
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sortMode.value === "recent") {
    return items.sort((a, b) => {
      if (a.weeksSinceSeen === null && b.weeksSinceSeen === null) return 0;
      if (a.weeksSinceSeen === null) return 1;
      if (b.weeksSinceSeen === null) return -1;
      return a.weeksSinceSeen - b.weeksSinceSeen;
    });
  }
  // "overdue": highest weeksSinceSeen first, nulls at bottom
  return items.sort((a, b) => {
    if (a.weeksSinceSeen === null && b.weeksSinceSeen === null) return 0;
    if (a.weeksSinceSeen === null) return 1;
    if (b.weeksSinceSeen === null) return -1;
    return b.weeksSinceSeen - a.weeksSinceSeen;
  });
});

function badgeColor(weeksSinceSeen) {
  if (weeksSinceSeen === null) return "grey-6";
  if (weeksSinceSeen === 0) return "positive";
  if (weeksSinceSeen <= 3) return "info";
  if (weeksSinceSeen <= 8) return "warning";
  return "negative";
}

function badgeLabel(weeksSinceSeen) {
  if (weeksSinceSeen === null) return "Never recorded";
  if (weeksSinceSeen === 0) return "Available this week!";
  if (weeksSinceSeen === 1) return "1 week ago";
  return `${weeksSinceSeen} weeks ago`;
}
</script>

<template>
  <q-page class="q-pa-md">
    <div style="max-width: 960px; margin: auto">
      <div class="row items-center q-mb-md q-gutter-sm">
        <div class="text-h5">Rewards Store</div>
        <q-space />
        <q-btn-toggle
          v-model="sortMode"
          flat
          toggle-color="primary"
          :options="[
            { label: 'Most Overdue', value: 'overdue' },
            { label: 'Alphabetical', value: 'alpha' },
            { label: 'Recently Seen', value: 'recent' },
          ]"
        />
      </div>

      <div class="rewards-grid">
        <q-card
          v-for="item in sortedItems"
          :key="item.id"
          flat
          bordered
          class="reward-card"
        >
          <q-card-section class="q-pb-xs">
            <div class="row items-start no-wrap">
              <div class="col">
                <div class="text-subtitle1 text-weight-bold">{{ item.name }}</div>
              </div>
              <q-chip
                dense
                color="grey-3"
                text-color="grey-8"
                class="q-ml-xs q-mt-xs"
                style="font-size: 0.7rem"
              >
                {{ item.category }}
              </q-chip>
            </div>
          </q-card-section>

          <q-card-section class="q-pt-xs q-pb-sm">
            <!-- History dots -->
            <div class="row items-center q-gutter-xs q-mb-sm">
              <q-icon name="history" size="14px" color="grey-5" />
              <div
                v-for="(seen, i) in item.historyDots"
                :key="i"
                class="history-dot"
                :class="seen ? 'history-dot--seen' : 'history-dot--absent'"
              />
            </div>

            <!-- Last seen badge -->
            <q-chip
              :color="badgeColor(item.weeksSinceSeen)"
              text-color="white"
              dense
              icon="schedule"
            >
              {{ badgeLabel(item.weeksSinceSeen) }}
            </q-chip>
          </q-card-section>
        </q-card>
      </div>

      <div v-if="sortedRotations.length > 0" class="text-caption text-grey-6 q-mt-md">
        Last rotation recorded: {{ sortedRotations[0].week }}
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.rewards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.reward-card {
  transition: box-shadow 0.15s;
}
.reward-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
}

.history-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.history-dot--seen {
  background: var(--q-primary);
}
.history-dot--absent {
  border: 1.5px solid #bdbdbd;
  background: transparent;
}
</style>
