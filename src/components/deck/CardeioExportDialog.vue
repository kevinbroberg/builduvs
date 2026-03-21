<script setup>
import { ref, computed } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { useCardeioStore } from 'src/stores/cardeio'
import { useDeckStore } from 'src/stores/deck'
import CardeioCardPickerDialog from './CardeioCardPickerDialog.vue'

const emit = defineEmits([...useDialogPluginComponent.emits])
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const cardeio = useCardeioStore()
const deckStore = useDeckStore()

// --- token step ---
const tokenInput = ref('')
const tokenError = ref('')
const validating = ref(false)

async function saveToken() {
  if (!tokenInput.value.trim()) return
  validating.value = true
  tokenError.value = ''
  cardeio.setToken(tokenInput.value.trim())
  const ok = await cardeio.validateToken()
  validating.value = false
  if (!ok) {
    tokenError.value = 'Token rejected — make sure it\'s a fresh Bearer token from carde.io'
    cardeio.clearToken()
  }
}

// --- deck ID step ---
const deckUrl = ref('')
const pushing = ref(false)
const unmatched = ref([])
const fixes = ref({}) // { cardName -> cardeioId }
const pushError = ref('')
const done = ref(false)
const savedDeckId = ref(null)

const deckId = computed(() => {
  const m = deckUrl.value.match(/([a-f0-9]{24})/)
  return m ? m[1] : null
})

async function push(currentFixes = {}) {
  if (!deckId.value) return
  pushing.value = true
  pushError.value = ''
  savedDeckId.value = deckId.value
  try {
    const result = await cardeio.pushDeck(deckId.value, deckStore, currentFixes)
    unmatched.value = result.unmatched
    done.value = true
  } catch (e) {
    pushError.value = e.message
  } finally {
    pushing.value = false
  }
}

// --- fix step ---
const repushing = ref(false)
const pickerOpen = ref(false)
const pickerCard = ref(null)

function openPicker(missedCard) {
  pickerCard.value = missedCard
  pickerOpen.value = true
}

function onPick({ id }) {
  if (pickerCard.value) {
    fixes.value = { ...fixes.value, [pickerCard.value.name]: id }
  }
}

async function repush() {
  done.value = false
  repushing.value = true
  await push(fixes.value)
  repushing.value = false
}
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card style="min-width: 400px">

      <!-- Step 1: Token -->
      <template v-if="!cardeio.hasToken">
        <q-card-section>
          <div class="text-h6">Connect to carde.io</div>
          <p class="q-mt-sm">
            Open <a href="https://play.uvsgames.com" target="_blank">play.uvsgames.com</a>,
            log in, then open DevTools (F12) → Network tab → click any request →
            copy the <code>Authorization</code> header value (everything after <code>Bearer </code>).
          </p>
          <q-input
            v-model="tokenInput"
            type="textarea"
            autogrow
            outlined
            label="Paste Bearer token"
            :error="!!tokenError"
            :error-message="tokenError"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="onDialogCancel" />
          <q-btn
            color="primary"
            label="Connect"
            :loading="validating"
            :disable="!tokenInput.trim()"
            @click="saveToken"
          />
        </q-card-actions>
      </template>

      <!-- Step 2: Push -->
      <template v-else-if="!done">
        <q-card-section>
          <div class="text-h6">Push to carde.io</div>
          <p class="q-mt-sm">
            Create a blank deck at
            <a href="https://play.uvsgames.com/decks" target="_blank">play.uvsgames.com/decks</a>,
            then paste its URL here.
          </p>
          <q-input
            v-model="deckUrl"
            outlined
            label="carde.io deck URL or ID"
            hint="e.g. https://play.uvsgames.com/decks/694627db9f5abf22ffd0f171"
            :error="!!pushError"
            :error-message="pushError"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Disconnect" @click="cardeio.clearToken()" />
          <q-btn flat label="Cancel" @click="onDialogCancel" />
          <q-btn
            color="primary"
            label="Push deck"
            :loading="pushing"
            :disable="!deckId"
            @click="push"
          />
        </q-card-actions>
      </template>

      <!-- Step 3: Result -->
      <template v-else>
        <q-card-section>
          <div class="text-h6 text-dark">Done!</div>
          <p class="text-dark">Your deck has been pushed to carde.io.</p>
          <template v-if="unmatched.length">
            <p class="text-warning">{{ unmatched.length }} card(s) couldn't be matched and were skipped:</p>
            <q-list dense separator>
              <q-item v-for="miss in unmatched" :key="miss.name">
                <q-item-section>
                  <q-item-label class="text-dark">{{ miss.count }}x {{ miss.name }}</q-item-label>
                  <!-- <q-item-label caption class="text-positive" v-if="fixes[miss.name]">Fixed</q-item-label> -->
                </q-item-section>
                <q-item-section side>
                  <q-btn
                    flat dense
                    :label="fixes[miss.name] ? 'Change' : 'Fix'"
                    :color="fixes[miss.name] ? 'positive' : 'warning'"
                    @click="openPicker(miss)"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </template>
          <p v-else class="text-positive">All cards matched successfully.</p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            v-if="unmatched.length && Object.keys(fixes).length"
            color="primary"
            label="Re-push with fixes"
            :loading="repushing"
            @click="repush"
          />
          <q-btn flat label="Close" color="dark" @click="onDialogOK" />
        </q-card-actions>
      </template>

      <CardeioCardPickerDialog
        v-model="pickerOpen"
        :unmatchedName="pickerCard?.name ?? ''"
        @pick="onPick"
      />

    </q-card>
  </q-dialog>
</template>
