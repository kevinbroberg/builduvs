<script setup>
import { ref, computed, onMounted } from 'vue'
import { copyToClipboard, useQuasar } from 'quasar'

// The dataset itself is built by scripts/gen-dataset.mjs into public/data/ and
// served as static files. This page only explains it and hands people the files
// and a starter prompt; the asking happens in whatever assistant they use.

const $q = useQuasar()
const base = `${window.location.origin}/data`

const FILES = [
  { file: 'README.md',      icon: 'description', what: 'Schema, caveats and example queries. Upload this alongside the data.' },
  { file: 'events.csv',     icon: 'event',       what: 'One row per tournament: date, location, size, type, format era.' },
  { file: 'decks.csv',      icon: 'person',      what: 'One row per placing: character, deck name, records, top cut.' },
  { file: 'matches.csv',    icon: 'swap_horiz',  what: 'Round-by-round results with the opponent\'s character.' },
  { file: 'deck_cards.csv', icon: 'style',       what: 'Every card line of every known decklist.' },
  { file: 'cards.csv',      icon: 'search',      what: 'Every printed card: stats, symbols, keywords, rules text.' },
]

// schema.json is a couple of KB; it lets the page show live counts without
// downloading any of the CSVs.
const schema = ref(null)
onMounted(async () => {
  try {
    const res = await fetch(`${base}/schema.json`)
    if (res.ok) schema.value = await res.json()
  } catch { /* counts are decoration; the links work without them */ }
})
const rows = name => schema.value?.row_counts?.[name]?.toLocaleString()

const question = ref('')
const prompt = computed(() => `I've attached Universus (UVS) card game tournament data from BuildUVS: CSV tables plus a README describing every column and the caveats.

Read the README first. Then answer my question by running code against the files. Don't answer from memory. Show the query or code you used, state the sample size behind every number, and flag anything that rests on fewer than ~20 matches or decks.

My question: ${question.value.trim() || '<your question here>'}`)

function copyPrompt() {
  copyToClipboard(prompt.value).then(
    () => $q.notify({ message: 'Prompt copied', icon: 'content_copy', timeout: 1500 }),
    () => $q.notify({ type: 'negative', message: 'Could not copy. Select the text instead.' }),
  )
}

const EXAMPLES = [
  'Which characters over-performed their play rate at 2026 regionals?',
  'What is Rodan\'s record against each Godzilla variant, excluding mirrors?',
  'Which cards did Worlds top-8 decks play that the rest of the field didn\'t?',
  'How did the most-played characters shift from Reign of Kaiju to Tekken 8?',
]

const duckdb = `INSTALL httpfs; LOAD httpfs;
CREATE VIEW decks   AS SELECT * FROM '${base}/decks.csv';
CREATE VIEW matches AS SELECT * FROM '${base}/matches.csv';
-- …events, deck_cards, cards likewise. See README.md for two handy views.`
</script>

<template>
  <div class="q-pa-md ask-page">
    <h1 class="text-h5 q-mt-none q-mb-sm">Ask the tournament data</h1>
    <p class="text-body1">
      Every decklist, placing and match result on
      <router-link to="/lists">Decklists</router-link> and
      <router-link to="/majors">Majors</router-link> is available as plain tables.
      Hand them to the AI assistant you already use (Claude, ChatGPT, Gemini…) and
      ask questions in your own words.
      <span v-if="schema" class="text-grey-7">
        {{ rows('events') }} events, {{ rows('decks') }} placings, {{ rows('matches') }} match results,
        {{ schema.date_range[0] }} to {{ schema.date_range[1] }}.
      </span>
    </p>
    <p class="text-caption text-grey-7">Player names are not included.</p>

    <h2 class="text-h6 q-mb-xs">1. Download the files</h2>
    <p class="text-body2 q-mb-sm">
      You rarely need all of them. Most questions about characters and matchups need
      <code>events</code>, <code>decks</code> and <code>matches</code>. Questions about
      cards need <code>deck_cards</code> and <code>cards</code>. Always include the README.
    </p>
    <q-list bordered separator class="rounded-borders">
      <q-item v-for="f in FILES" :key="f.file" clickable tag="a" :href="`${base}/${f.file}`" download>
        <q-item-section avatar><q-icon :name="f.icon" /></q-item-section>
        <q-item-section>
          <q-item-label><code>{{ f.file }}</code></q-item-label>
          <q-item-label caption>{{ f.what }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <span v-if="rows(f.file.replace('.csv', ''))" class="text-caption">
            {{ rows(f.file.replace('.csv', '')) }} rows
          </span>
          <q-icon v-else name="download" />
        </q-item-section>
      </q-item>
    </q-list>

    <h2 class="text-h6 q-mb-xs">2. Upload them and ask</h2>
    <p class="text-body2 q-mb-sm">
      Attach the files in a new chat and paste this prompt. Use an assistant that can
      run code on uploaded files (Claude and ChatGPT both can) so the numbers are
      computed, not guessed.
    </p>
    <q-input v-model="question" outlined dense autogrow label="Your question (optional)" class="q-mb-sm" />
    <div class="column items-start q-gutter-xs q-mb-sm">
      <q-btn v-for="ex in EXAMPLES" :key="ex" outline dense no-caps size="sm" align="left"
        class="example" icon="lightbulb" :label="ex" @click="question = ex" />
    </div>
    <pre class="prompt">{{ prompt }}</pre>
    <div class="row q-gutter-sm">
      <q-btn color="primary" icon="content_copy" label="Copy prompt" @click="copyPrompt" />
      <q-btn outline icon="open_in_new" label="Claude" href="https://claude.ai/new" target="_blank" />
      <q-btn outline icon="open_in_new" label="ChatGPT" href="https://chatgpt.com/" target="_blank" />
    </div>

    <h2 class="text-h6 q-mb-xs">Prefer SQL or Python?</h2>
    <p class="text-body2 q-mb-sm">
      The files are served with open CORS, so DuckDB, pandas, notebooks and browser
      tools can read them directly from <code>{{ base }}/</code>:
    </p>
    <pre class="prompt">{{ duckdb }}</pre>
  </div>
</template>

<style scoped>
.ask-page {
  max-width: 760px;
  margin: 0 auto;
}
.example {
  max-width: 100%;
  text-align: left;
}
.prompt {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.85em;
  background: rgba(127, 127, 127, 0.1);
  border-radius: 4px;
  padding: 10px 12px;
}
</style>
