<script setup>
// A row of color swatches plus a "custom" one that opens a full picker. With
// `allowDefault`, a leading swatch sets the value back to null ("use the default").
const model = defineModel({ type: String, default: null })

defineProps({
  palette: { type: Array, required: true },
  allowDefault: Boolean,
  defaultLabel: { type: String, default: 'Default' },
})

const isCustom = (palette) => model.value && !palette.includes(model.value)
</script>

<template>
  <div class="swatches">
    <button v-if="allowDefault" type="button" class="swatch swatch--default"
      :class="{ 'swatch--on': model == null }" :title="defaultLabel" @click="model = null">
      <q-icon name="block" size="16px" />
    </button>
    <button v-for="c in palette" :key="c" type="button" class="swatch" :title="c"
      :class="{ 'swatch--on': model === c }" :style="{ background: c }" @click="model = c" />
    <button type="button" class="swatch swatch--custom" title="Custom color"
      :class="{ 'swatch--on': isCustom(palette) }"
      :style="isCustom(palette) ? { background: model } : null">
      <q-icon v-if="!isCustom(palette)" name="colorize" size="16px" />
      <q-popup-proxy>
        <q-color :model-value="model || '#888888'" no-header-tabs default-view="spectrum"
          @update:model-value="v => (model = v)" />
      </q-popup-proxy>
    </button>
  </div>
</template>

<style scoped>
.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.swatch {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid rgba(127, 127, 127, 0.45);
  display: grid;
  place-items: center;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.swatch--on {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}
</style>
