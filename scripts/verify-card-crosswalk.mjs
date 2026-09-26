/**
 * Coverage check for the card crosswalk: how much of the real decklist corpus
 * actually resolves to a canonical id, by source.
 *
 * Run after build-card-crosswalk.mjs. Anything it lists as unresolved is a card
 * genuinely absent from src/assets/*.json, not a matching failure — that is the
 * whole point of moving the fuzzy work offline, so gaps surface as data to fix
 * rather than disappearing into a silent name miss.
 *
 * Usage: node scripts/verify-card-crosswalk.mjs
 */
import fs from 'fs'
import path from 'path'
import { buildResolver } from '../src/js/card_lookup.js'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..')
const p = (...a) => path.join(root, ...a)
const resolve = buildResolver(JSON.parse(fs.readFileSync(p('src', 'assets', 'card-crosswalk.json'), 'utf8')))

// ── 1. vendor ids in the scraper caches ──────────────────────────────────────
const CACHES = [
  ['lc-round3-cache-v1.json', 'hydra'], ['lc-round4-cache-v1.json', 'hydra'],
  ['regionals-hydra-cache-v1.json', 'hydra'], ['lc-round1-cache-v4.json', 'cardeio'],
  ['lc-round2-cache-v3.json', 'cardeio'], ['regionals-cache.json', 'cardeio'],
  ['majors-cache-v1.json', 'cardeio'],
]
console.log('vendor ids in scraper caches')
let vTot = 0, vHit = 0
const vMiss = new Map()
for (const [file, kind] of CACHES) {
  const fp = p(file)
  if (!fs.existsSync(fp)) { console.log(`  ${file.padEnd(32)} (absent)`); continue }
  let tot = 0, hit = 0
  const visit = o => {
    if (!o || typeof o !== 'object') return
    if (Array.isArray(o)) return o.forEach(visit)
    if (kind === 'hydra' && o.card?.id) {
      tot++
      if (resolve({ hydraId: o.card.id, name: o.card.name })) hit++
      else vMiss.set(o.card.id, o.card.name || '?')
    }
    if (kind === 'cardeio' && o.cardId) {
      tot++
      if (resolve({ cardeioId: o.cardId })) hit++
      else vMiss.set(o.cardId, '?')
    }
    for (const k of Object.keys(o)) visit(o[k])
  }
  visit(JSON.parse(fs.readFileSync(fp, 'utf8')))
  vTot += tot; vHit += hit
  console.log(`  ${file.padEnd(32)} ${String(hit).padStart(6)}/${String(tot).padEnd(7)} ${pct(hit, tot)}`)
}
console.log(`  ${'TOTAL'.padEnd(32)} ${String(vHit).padStart(6)}/${String(vTot).padEnd(7)} ${pct(vHit, vTot)}   unresolved ids: ${vMiss.size}`)

// ── 2. card names in the decklist markdown (what gen-locals ingests) ─────────
const DIRS = ['lc-round1', 'lc-round2', 'lc-round3', 'lc-round4', 'regionals', 'majors']
const counts = new Map()
let files = 0
const walk = d => {
  if (!fs.existsSync(d)) return
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const fp = path.join(d, e.name)
    if (e.isDirectory()) { walk(fp); continue }
    if (!e.name.endsWith('.md') || /SUMMARY/i.test(e.name)) continue
    files++
    for (const m of fs.readFileSync(fp, 'utf8').matchAll(/^\s*(\d+)x\s+(.+?)\s*$/gm)) {
      counts.set(m[2], (counts.get(m[2]) || 0) + Number(m[1]))
    }
  }
}
for (const d of DIRS) walk(p(d))

let nTot = 0, nHit = 0
const nMiss = []
for (const [name, n] of counts) {
  nTot += n
  if (resolve({ name })) nHit += n
  else nMiss.push([name, n])
}
nMiss.sort((a, b) => b[1] - a[1])
console.log(`\ndecklist markdown  ${files} files, ${counts.size} distinct names`)
console.log(`  copies resolved  ${nHit}/${nTot} ${pct(nHit, nTot)}   unresolved names: ${nMiss.length}`)
if (nMiss.length) {
  console.log('\n  cards missing from src/assets/*.json (copies played):')
  for (const [name, n] of nMiss) console.log(`    ${String(n).padStart(5)}  ${name}`)
}

function pct(a, b) { return b ? `${(Math.round(1000 * a / b) / 10).toFixed(1)}%` : '—' }
