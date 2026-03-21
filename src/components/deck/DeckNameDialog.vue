<script setup>
import { ref } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { formatOptions } from 'src/js/card_provider'

const props = defineProps({
  initialName: { type: String, default: 'Untitled Deck' },
  initialFormat: { type: String, default: null },
})

const emit = defineEmits([...useDialogPluginComponent.emits])
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

const deckName = ref(props.initialName)
const deckFormat = ref(props.initialFormat)

function submit() {
  onDialogOK({ name: deckName.value, format: deckFormat.value })
}
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card style="min-width: 350px">
      <q-card-section>
        <div class="text-h6">Save Deck</div>
      </q-card-section>

      <q-card-section>
        <q-input
          v-model="deckName"
          label="Deck Name"
          autofocus
          @keyup.enter="submit"
        />
        <q-select
          v-model="deckFormat"
          :options="formatOptions"
          label="Format (optional)"
          clearable
          class="q-mt-md"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" @click="onDialogCancel" />
        <q-btn flat label="Save" color="primary" @click="submit" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
