<script setup>

import { useDialogPluginComponent, useQuasar } from 'quasar'

const $q = useQuasar()

import DeckLoaderDialog from 'components/deck/DeckLoaderDialog.vue'
function deckLoadDialog() {
  $q.dialog({
    // TODO can I put this component itself here, and bring the logic into 1 file?
    component: DeckLoaderDialog,
  })
  // .onOk(() => {
  //   console.log('OK')
  // }).onCancel(() => {
  //   console.log('Cancel')
  // }).onDismiss(() => {
  //   console.log('Called on OK or Cancel')
  // })
}



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
  <q-btn push stack dense round icon="file_upload" @click="deckLoadDialog">
    <q-tooltip>Load a deck from file or with text input</q-tooltip>
  </q-btn>
</template>