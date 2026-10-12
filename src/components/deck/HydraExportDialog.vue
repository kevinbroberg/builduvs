<script setup>
import { ref, onMounted } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { useHydraStore, hydraDeckUrl } from 'src/stores/hydra'
import { useDeckStore } from 'src/stores/deck'

defineEmits([...useDialogPluginComponent.emits])
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const hydra = useHydraStore()
const deckStore = useDeckStore()

// --- Step 1: connect -------------------------------------------------------
const tokenInput = ref('')
const tokenError = ref('')
const validating = ref(false)

async function connect() {
  if (!tokenInput.value.trim()) return
  validating.value = true
  tokenError.value = ''
  hydra.setToken(tokenInput.value)
  const ok = await hydra.validateToken()
  validating.value = false
  if (!ok) {
    hydra.clearToken()
    tokenError.value = 'Token rejected. Make sure you copied the whole Authorization value while logged in.'
  }
}

// A stored token may have expired since last time; find out before the user
// fills anything in.
onMounted(async () => {
  if (hydra.hasToken && !hydra.user) {
    validating.value = true
    if (!(await hydra.validateToken())) {
      hydra.clearToken()
      tokenError.value = 'Your saved token has expired. Paste a fresh one.'
    }
    validating.value = false
  }
})

// --- Step 2: publish -------------------------------------------------------
const deckName = ref(deckStore.currentDeckName || 'Untitled Deck')
const target = ref(deckStore.currentHydraId ? 'update' : 'new')
const publishing = ref(false)
const publishError = ref('')
const result = ref(null)

async function publish() {
  if (!deckName.value.trim()) return
  publishing.value = true
  publishError.value = ''
  try {
    const existing = target.value === 'update' ? deckStore.currentHydraId : null
    result.value = await hydra.publish(deckName.value.trim(), deckStore, existing)
    deckStore.currentHydraId = result.value.deckId
  } catch (e) {
    publishError.value = e.message
  } finally {
    publishing.value = false
  }
}
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card style="width: 460px; max-width: 95vw">

      <!-- Checking a saved token -->
      <q-card-section v-if="validating && !tokenInput" class="row items-center q-gutter-sm">
        <q-spinner size="sm" /> <span>Connecting to play.uvsgames.com…</span>
      </q-card-section>

      <!-- Step 1: Connect -->
      <template v-else-if="!hydra.hasToken">
        <q-card-section>
          <div class="text-h6">Connect to play.uvsgames.com</div>
          <ol class="q-pl-md q-my-sm">
            <li>Log in at <a href="https://play.uvsgames.com" target="_blank" rel="noopener">play.uvsgames.com</a>.</li>
            <li>Open DevTools (F12) → <b>Network</b>, type <code>hydra</code> in its filter box,
              then click around the site.</li>
            <li>Click any request in the list and copy its <code>Authorization</code> request header
              (it looks like <code>Token 1a2b3c…</code>).</li>
          </ol>
          <div class="text-caption text-grey-7 q-mb-sm">
            The token stays in this browser and is only sent to play.uvsgames.com's API.
          </div>
          <q-input
            v-model="tokenInput"
            outlined
            autofocus
            label="Authorization token"
            :error="!!tokenError"
            :error-message="tokenError"
            @keyup.enter="connect"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="onDialogCancel" />
          <q-btn color="primary" label="Connect" :loading="validating"
            :disable="!tokenInput.trim()" @click="connect" />
        </q-card-actions>
      </template>

      <!-- Step 2: Publish -->
      <template v-else-if="!result">
        <q-card-section>
          <div class="text-h6">Publish to play.uvsgames.com</div>
          <div class="text-caption text-grey-7">
            Signed in as <b>{{ hydra.user }}</b>. Decks are created private.
          </div>
          <q-input v-model="deckName" outlined label="Deck name" class="q-mt-md"
            :error="!!publishError" :error-message="publishError" @keyup.enter="publish" />
          <q-option-group
            v-if="deckStore.currentHydraId"
            v-model="target"
            :options="[
              { value: 'update', label: 'Update the deck I published before' },
              { value: 'new', label: 'Publish as a new deck' },
            ]"
            dense
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Disconnect" @click="hydra.clearToken()" />
          <q-space />
          <q-btn flat label="Cancel" @click="onDialogCancel" />
          <q-btn color="primary" label="Publish" :loading="publishing"
            :disable="!deckName.trim()" @click="publish" />
        </q-card-actions>
      </template>

      <!-- Step 3: Result -->
      <template v-else>
        <q-card-section>
          <div class="text-h6">{{ result.updated ? 'Updated' : 'Published' }}</div>
          <q-btn
            class="q-mt-sm"
            color="primary"
            icon-right="open_in_new"
            label="Open on play.uvsgames.com"
            :href="hydraDeckUrl(result.deckId)"
            target="_blank"
            rel="noopener"
          />

          <template v-if="result.unmatched.length">
            <div class="text-warning text-weight-medium q-mt-md">
              {{ result.unmatched.length }} card(s) aren't in play.uvsgames.com's card list and were left out:
            </div>
            <ul class="q-my-xs">
              <li v-for="name in result.unmatched" :key="name">{{ name }}</li>
            </ul>
          </template>
          <div v-else class="text-positive q-mt-md">Every card matched.</div>

          <q-expansion-item
            v-if="result.legality.length"
            dense
            class="q-mt-sm"
            icon="gavel"
            :label="`Standard legality notes (${result.legality.length})`"
          >
            <ul class="q-my-xs text-caption">
              <li v-for="msg in result.legality" :key="msg">{{ msg }}</li>
            </ul>
          </q-expansion-item>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Close" @click="onDialogOK" />
        </q-card-actions>
      </template>

    </q-card>
  </q-dialog>
</template>
