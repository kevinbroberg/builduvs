<script setup>
import { ref, computed, defineEmits, defineProps } from 'vue'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { useStore } from 'vuex'
import Filters from './Filters.vue'
const $store = useStore()
const text = ref('')
const fileModel = ref(null)
const deckChanged = ref(false)


  const emit = defineEmits(
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    [...useDialogPluginComponent.emits]
  )
  
  // REQUIRED; must be called inside of setup()
  const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
// dialogRef      - Vue ref to be applied to QDialog
// onDialogHide   - Function to be used as handler for @hide on QDialog
// onDialogOK     - Function to call to settle dialog with "ok" outcome
//                    example: onDialogOK() - no payload
//                    example: onDialogOK({ /*.../* }) - with payload
// onDialogCancel - Function to call to settle dialog with "cancel" outcome
    
</script>

<template>
<!-- notice dialogRef here -->
<!-- TODO I don't love full-width -->
  <q-dialog ref="dialogRef" @hide="onDialogHide" full-width>    
    <div>
      <Filters />
    </div>
  </q-dialog>
</template>