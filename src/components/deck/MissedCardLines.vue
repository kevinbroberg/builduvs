<script setup>
// The decklist lines an import couldn't match to a card, shown before the deck
// loads so nothing goes missing without notice. Used by DeckLoaderDialog and
// DeckImportDialog.
defineProps({ lines: { type: Array, required: true } })
</script>

<template>
  <q-banner v-if="lines.length" dense rounded class="bg-orange-1 text-orange-10 q-mt-sm">
    <template #avatar><q-icon name="warning" color="orange-8" /></template>
    <div class="text-weight-medium">
      {{ lines.length }} line{{ lines.length === 1 ? '' : 's' }} didn't match any card and will be left out:
    </div>
    <ul class="q-my-xs q-pl-md">
      <li v-for="line in lines" :key="line">{{ line }}</li>
    </ul>
    <div class="text-caption">Fix the spelling above, or load the deck without them.</div>
  </q-banner>
</template>
