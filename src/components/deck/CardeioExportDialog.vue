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
const tokenMethod = ref('devtools')
const bookmarkletCopied = ref(false)
function copyBookmarkletSource() {
  navigator.clipboard.writeText(bookmarkletSource).then(() => {
    bookmarkletCopied.value = true
    setTimeout(() => { bookmarkletCopied.value = false }, 2000)
  })
}

const bookmarkletSource = `(function() {
  var keys = Object.keys(localStorage).filter(function(k) {
    return k.indexOf('@@auth0spajs@@') > -1 && k.indexOf('carde.io') > -1;
  });
  if (!keys.length) {
    alert('No Auth0 session found — make sure you are logged in at play.uvsgames.com');
    return;
  }
  var token = null;
  keys.forEach(function(k) {
    try {
      var d = JSON.parse(localStorage.getItem(k));
      if (d && d.body && d.body.access_token) token = d.body.access_token;
    } catch(e) {}
  });
  if (!token) {
    alert('Could not extract token. Try the DevTools method instead.');
    return;
  }
  navigator.clipboard.writeText(token)
    .then(function() { alert('Token copied! Paste it into BuildUVS.'); })
    .catch(function() { prompt('Copy this token:', token); });
})()`

const bookmarklet = computed(() => {
  const code = `(function(){
    var keys=Object.keys(localStorage).filter(function(k){return k.indexOf('@@auth0spajs@@')>-1&&k.indexOf('carde.io')>-1;});
    if(!keys.length){alert('No Auth0 session found — make sure you are logged in at play.uvsgames.com');return;}
    var token=null;
    keys.forEach(function(k){try{var d=JSON.parse(localStorage.getItem(k));if(d&&d.body&&d.body.access_token)token=d.body.access_token;}catch(e){}});
    if(!token){alert('Could not extract token. Try the DevTools method instead.');return;}
    navigator.clipboard.writeText(token).then(function(){alert('Token copied! Paste it into BuildUVS.');}).catch(function(){prompt('Copy this token:',token);});
  })()`
  return 'javascript:' + encodeURIComponent(code)
})

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
const deckName = ref(deckStore.currentDeckName || 'Untitled Deck')
const pushing = ref(false)
const unmatched = ref([])
const fixes = ref({}) // { cardName -> cardeioId }
const pushError = ref('')
const done = ref(false)
const savedDeckId = ref(null)

async function push(currentFixes = {}) {
  if (!deckName.value.trim()) return
  pushing.value = true
  pushError.value = ''
  try {
    const result = await cardeio.createDeck(deckName.value.trim(), deckStore, currentFixes)
    savedDeckId.value = result.deckId
    unmatched.value = result.unmatched
    done.value = true
    deckStore.currentCardeioId = result.deckId
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
  try {
    const result = await cardeio.pushDeck(savedDeckId.value, deckStore, fixes.value)
    unmatched.value = result.unmatched
    done.value = true
  } catch (e) {
    pushError.value = e.message
  } finally {
    repushing.value = false
  }
}
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card style="min-width: 400px">

      <!-- Step 1: Token -->
      <template v-if="!cardeio.hasToken">
        <q-card-section>
          <div class="text-h6">Connect to carde.io</div>

          <q-tabs v-model="tokenMethod" dense align="left" class="q-mt-sm">
            <q-tab name="devtools" label="DevTools" icon="code" />
            <q-tab name="bookmarklet" label="Bookmarklet" icon="bookmark" />
          </q-tabs>
          <q-separator />

          <q-tab-panels v-model="tokenMethod" animated>
            <q-tab-panel name="devtools" class="q-pa-sm">
              <p>
                Open <a href="https://play.uvsgames.com" target="_blank">play.uvsgames.com</a>,
                log in, then open DevTools (F12) → Network tab → click any request →
                copy the <code>Authorization</code> header value (everything after <code>Bearer </code>).
              </p>
            </q-tab-panel>
            <q-tab-panel name="bookmarklet" class="q-pa-sm">
              <p>
                1. Drag this link to your bookmarks bar:
                <a :href="bookmarklet" class="bookmarklet-btn" @click.prevent="copyBookmarkletSource">{{ bookmarkletCopied ? '✅ Source copied!' : '📋 Copy carde.io token' }}</a>
              </p>
              <p>
                2. Go to <a href="https://play.uvsgames.com" target="_blank">play.uvsgames.com</a> and log in.
              </p>
              <p>3. Click the bookmark — your token will be copied to clipboard.</p>
              <p>4. Paste it below.</p>
            </q-tab-panel>
          </q-tab-panels>

          <q-input
            v-model="tokenInput"
            type="textarea"
            autogrow
            outlined
            label="Paste Bearer token"
            :error="!!tokenError"
            :error-message="tokenError"
          />
          <q-input
            v-if="tokenMethod === 'bookmarklet'"
            :model-value="bookmarkletSource"
            type="textarea"
            autogrow
            outlined
            readonly
            dense
            label="Bookmarklet source"
            class="q-mt-sm"
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
          <div class="text-h6">Export to carde.io</div>
          <q-input
            v-model="deckName"
            outlined
            label="Deck name"
            class="q-mt-sm"
            :error="!!pushError"
            :error-message="pushError"
            @keyup.enter="push"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Disconnect" @click="cardeio.clearToken()" />
          <q-btn flat label="Cancel" @click="onDialogCancel" />
          <q-btn
            color="primary"
            label="Create & push"
            :loading="pushing"
            :disable="!deckName.trim()"
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

<style scoped>
.bookmarklet-btn {
  display: inline-block;
  padding: 4px 10px;
  background: #1976d2;
  color: white;
  border-radius: 4px;
  text-decoration: none;
  cursor: grab;
  user-select: none;
}
.bookmarklet-btn:hover {
  background: #1565c0;
}
</style>
