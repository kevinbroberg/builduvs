<script setup>
// Settings for one tier, opened from the gear on its row: label color and text,
// the row's background, and row-level actions (modeled on TierMaker's row settings).
// Edits apply live to the store.
import { computed } from 'vue'
import { useTiersStore } from 'src/stores/tiers'
import { LABEL_PALETTE, ROW_PALETTE, textOn } from 'src/js/tier_colors'
import TierLabel from 'src/components/tiers/TierLabel.vue'
import EmojiPicker from 'src/components/tiers/EmojiPicker.vue'
import ColorSwatches from 'src/components/tiers/ColorSwatches.vue'

const open = defineModel('open', { type: Boolean, default: false })
const props = defineProps({
  tierId: { type: String, default: null },
})

const store = useTiersStore()
const index = computed(() => store.tiers.findIndex(t => t.id === props.tierId))
const tier = computed(() => store.tiers[index.value])
const cardCount = computed(() => (store.placements[props.tierId] || []).length)

function addEmoji(name) {
  tier.value.label = `${tier.value.label.trimEnd()} :${name}:`.trimStart()
}

function remove() {
  store.removeTier(props.tierId)
  open.value = false
}
</script>

<template>
  <q-dialog v-model="open">
    <q-card v-if="tier" style="width: 480px; max-width: 94vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6 col">Row settings</div>
        <q-btn flat round dense icon="close" v-close-popup />
      </q-card-section>

      <q-card-section class="q-gutter-y-md">
        <!-- WYSIWYG: the row as the board draws it -->
        <div class="trd-preview">
          <div class="trd-preview__label" :style="{ background: tier.color, color: textOn(tier.color) }">
            <TierLabel :label="tier.label" jumbo />
          </div>
          <div class="trd-preview__row" :style="{ background: tier.rowColor ?? store.rowColor ?? undefined }" />
        </div>

        <q-input v-model="tier.label" label="Label text" outlined dense autofocus>
          <template #append><EmojiPicker @pick="addEmoji" /></template>
        </q-input>

        <div>
          <div class="text-caption text-grey-7 q-mb-xs">Label color</div>
          <ColorSwatches v-model="tier.color" :palette="LABEL_PALETTE" />
        </div>

        <div>
          <div class="text-caption text-grey-7 q-mb-xs">Row background</div>
          <ColorSwatches v-model="tier.rowColor" :palette="ROW_PALETTE" allow-default
            default-label="Same as the board's" />
        </div>
      </q-card-section>

      <q-card-section class="trd-actions q-pt-none">
        <q-btn outline no-caps icon="vertical_align_top" label="Add a row above"
          @click="store.addTier(index)" />
        <q-btn outline no-caps icon="vertical_align_bottom" label="Add a row below"
          @click="store.addTier(index + 1)" />
        <q-btn outline no-caps icon="layers_clear" :label="`Clear row (${cardCount})`"
          :disable="!cardCount" @click="store.clearTier(tierId)" />
        <q-btn outline no-caps color="negative" icon="delete" label="Delete row"
          :disable="store.tiers.length <= 1" @click="remove" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.trd-preview {
  display: flex;
  min-height: 64px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(127, 127, 127, 0.08);
}
.trd-preview__label {
  flex: none;
  width: 104px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  text-align: center;
  font-weight: 700;
  font-size: 1.05rem;
  overflow-wrap: anywhere;
}
.trd-preview__row { flex: 1; }
.trd-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
</style>
