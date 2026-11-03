<script setup>
// The tier list as a picture (see src/js/tier_image.js): drawn when the dialog opens,
// previewed, then shared, saved or copied. Phones get the system share sheet (Save
// Image, Discord, Messages…). It's a button in here rather than straight off the
// board's button because a share has to start from a tap, and drawing a big list
// takes longer than the browser lets a tap count for.
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useTiersStore } from 'src/stores/tiers'
import { cardByAsset } from 'src/js/card_provider'
import { renderTierImage, canvasBlob } from 'src/js/tier_image'
import { tierFileName } from 'src/js/tier_file'

const open = defineModel('open', { type: Boolean, default: false })

const store = useTiersStore()
const $q = useQuasar()

const progress = ref(null)        // { done, total } while drawing
const error = ref('')
const url = ref('')               // the finished JPEG, for the preview and Save
const done = ref('')              // brief confirmation after Copy
let canvas = null
let file = null
let run = 0                       // so a reopen mid-draw drops the stale result

const fileName = computed(() => tierFileName(store.title, 'jpg'))
const canShare = ref(false)
const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write
const touch = computed(() => $q.platform.has.touch)

async function draw() {
  const mine = ++run
  reset()
  try {
    const tiers = store.tiers.map(t => ({
      ...t, cards: (store.placements[t.id] || []).map(a => cardByAsset.get(a)).filter(Boolean),
    }))
    const drawn = await renderTierImage({
      title: store.title, tiers, rowColor: store.rowColor, mode: store.viewMode, dark: $q.dark.isActive,
    }, (d, total) => { if (mine === run) progress.value = { done: d, total } })
    const blob = await canvasBlob(drawn)
    if (mine !== run) return
    canvas = drawn
    file = new File([blob], fileName.value, { type: blob.type })
    canShare.value = !!navigator.canShare?.({ files: [file] })
    url.value = URL.createObjectURL(blob)
  } catch (e) {
    if (mine === run) error.value = e.message || String(e)
  } finally {
    if (mine === run) progress.value = null
  }
}

function reset() {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
  error.value = ''
  done.value = ''
  canvas = null
  file = null
}

function onHide() {
  run++
  progress.value = null
  reset()
}

async function share() {
  try {
    await navigator.share({ files: [file] })
  } catch (e) {
    if (e.name !== 'AbortError') error.value = `Couldn't share: ${e.message}`
  }
}

function save() {
  const a = document.createElement('a')
  a.href = url.value
  a.download = fileName.value
  a.click()
}

// The clipboard only takes PNG. Handing ClipboardItem a promise, rather than awaiting
// the blob first, keeps Safari counting this as part of the tap.
async function copy() {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasBlob(canvas, 'image/png') })])
    done.value = 'Copied'
    setTimeout(() => { done.value = '' }, 1500)
  } catch (e) {
    error.value = `Couldn't copy: ${e.message}`
  }
}
</script>

<template>
  <q-dialog v-model="open" @show="draw" @hide="onHide">
    <q-card style="width: 640px; max-width: 94vw">
      <q-card-section class="row items-center q-pb-sm">
        <div class="text-h6 col">Share as image</div>
        <q-btn flat round dense icon="close" v-close-popup />
      </q-card-section>

      <q-card-section class="q-py-none">
        <div class="tid-preview">
          <img v-if="url" :src="url" :alt="store.title || 'Tier list'" class="tid-preview__img" />
          <div v-else-if="error" class="tid-preview__status text-negative">{{ error }}</div>
          <div v-else class="tid-preview__status">
            <q-spinner size="32px" color="primary" />
            <div v-if="progress?.total" class="q-mt-sm">
              Drawing {{ progress.done }} of {{ progress.total }} cards
            </div>
          </div>
        </div>
        <div v-if="url && error" class="text-negative text-caption q-mt-xs">{{ error }}</div>
        <div v-if="url && touch" class="text-caption text-grey-7 q-mt-xs">
          You can also press and hold the picture to save it.
        </div>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn v-if="canCopy" flat no-caps :icon="done ? 'check' : 'content_copy'" :label="done || 'Copy'"
          :disable="!url" @click="copy" />
        <q-btn :flat="canShare" :unelevated="!canShare" :color="canShare ? undefined : 'primary'" no-caps
          icon="file_download" label="Save" :disable="!url" @click="save" />
        <q-btn v-if="canShare" unelevated color="primary" no-caps icon="ios_share" label="Share"
          :disable="!url" @click="share" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.tid-preview {
  max-height: 62vh;
  overflow-y: auto;
  border-radius: 6px;
  background: rgba(127, 127, 127, 0.1);
}
.tid-preview__img {
  display: block;
  width: 100%;
  height: auto;
}
.tid-preview__status {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
}
</style>
