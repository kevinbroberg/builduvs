<script setup>
import { ref, computed, watch } from 'vue'
import cardeioIds from 'src/assets/cardeio-ids.json'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  unmatchedName: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'pick'])

const search = ref('')

watch(() => props.unmatchedName, (val) => { search.value = val }, { immediate: true })

const allCards = Object.entries(cardeioIds).map(([name, data]) => ({
  name, id: data.id, slug: data.slug, cardType: data.cardType,
}))

const results = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return []
  return allCards.filter(c => c.name.includes(q)).slice(0, 50)
})

function pick(card) {
  emit('pick', { id: card.id, name: card.name })
  emit('update:modelValue', false)
}
function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card style="min-width: 420px; max-height: 80vh; display: flex; flex-direction: column;">
      <q-card-section class="q-pb-none">
        <div class="text-h6 text-dark">Find carde.io card</div>
        <div class="text-caption text-grey q-mb-sm">Matching for: <em>{{ unmatchedName }}</em></div>
        <q-input
          v-model="search"
          outlined
          dense
          autofocus
          placeholder="Search by name..."
          clearable
          input-class="text-dark"
        />
      </q-card-section>

      <q-card-section style="overflow-y: auto; flex: 1;">
        <q-list separator>
          <q-item v-for="card in results" :key="card.id" clickable @click="pick(card)">
            <q-item-section>
              <q-item-label class="text-dark">{{ card.name }}</q-item-label>
              <q-item-label caption>{{ card.cardType }} · {{ card.slug }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="search && results.length === 0">
            <q-item-section class="text-grey">No matches</q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="dark" @click="close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
