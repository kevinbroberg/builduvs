/**
 * Build the vendor-id → canonical-id crosswalk that every decklist pipeline
 * resolves through.
 *
 * ── The problem this replaces ────────────────────────────────────────────────
 * Decklists arrive from two backends, each naming cards in its own space:
 *
 *   Hydra / tabletop.gg   deck rows carry card.id      — a UUID
 *   carde.io (legacy)     deck rows carry cardId       — a Mongo ObjectId
 *
 * Neither is our id. Until now the pipelines bridged the gap by matching on the
 * card's *name*, which fails in all the ways names fail: "Jin's Glove" is spelled
 * with U+2019 by the vendor and U+0027 in our card files, so /lists could not find
 * it in any of the 46 decks that played it. Reprints, variant suffixes
 * ("Best Jeanist (I)") and diacritics ("Hange Zoë") break it the same way.
 *
 * ── The fix ──────────────────────────────────────────────────────────────────
 * Do the fuzzy work ONCE, here, offline, with a report — then ship a plain
 * id → id table. Runtime stops guessing: it looks up a key.
 *
 *   deck row ──vendor id──► card-crosswalk.json ──► uvsId ("tk802-049") ──► card
 *
 * The Hydra catalog is the pivot: it holds both vendor ids at once (`id` is the
 * UUID, `externalId` is the same card's legacy ObjectId), so one catalog row
 * bridges both backends to one of our cards.
 *
 * ── How a Hydra card is matched to ours ──────────────────────────────────────
 * Vendor collector numbers do NOT agree with ours for older sets (Hydra's
 * jet-burn #2 is our mha06/38 — the sets are ordered differently), so a naive
 * (set, number) join scores 1/161 there. Name-within-set is the reliable signal,
 * so matching runs in two passes:
 *
 *   pass 1  names that are globally unique in our data resolve outright, and
 *           each match votes for a (hydra set → our set) affinity
 *   pass 2  ambiguous names are broken by that affinity, then by collector
 *           number, then left unresolved
 *
 * Deriving set affinity from the data beats hardcoding a set map: new products
 * map themselves, and a vendor renaming a set slug can't silently break it.
 *
 * Usage: node scripts/build-card-crosswalk.mjs
 * Reads:  data/hydra-uvs-catalog.json   (refresh with fetch-hydra-catalog.mjs)
 * Writes: src/assets/card-crosswalk.json
 *         data/card-crosswalk-report.json   (unresolved + ambiguous, for review)
 */
import fs from 'fs'
import path from 'path'
import { uvsId, cardSet, cardNumber, parseUvsId } from '../src/js/card_id.js'

const parseUvsSet = id => parseUvsId(id)?.set ?? null

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..')
const p = (...a) => path.join(root, ...a)

// Every file card_provider.js imports. Keep in sync with it.
const CARD_FILES = [
  'heroesclash.json', 'rampage_dlc.json', 'rampage.json', 'provs.json',
  'gg-critrole.json', 'sjw-mha4.json', 'cards.json', 'kaiju.json',
  'teamhero.json', 'mha09.json', 'tekken8.json', 'sf6-2026.json',
]

// ── name normalization ───────────────────────────────────────────────────────
// Deliberately more aggressive than src/js/card_name_match.js: this is a
// build-time bridge between two vendors' spellings, and every collapse it makes
// is reported rather than trusted silently.
const norm = s => (s || '')
  .toLowerCase()
  .replace(/[‘’‚‛′`]/g, "'")        // U+2019 & friends → U+0027  ← the Jin's Glove bug
  .replace(/[“”„]/g, '"')
  .replace(/[–—]/g, '-')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')  // "Zoë" → "Zoe"
  .replace(/\s+/g, ' ')
  .trim()

// "best jeanist (i)" → "best jeanist". Only a trailing roman numeral, so real
// parenthetical titles survive.
const stripVariant = s => s.replace(/\s*\((?:i{1,3}|iv|vi{0,3}|ix|x)\)\s*$/, '').trim()

// Front face of a flip card: "A // B" → "A"
const frontFace = s => (s.includes(' // ') ? s.split(' // ')[0].trim() : s)

// "Jacob Johnson, 2019 UK National Champion" -> "Jacob Johnson". The four-digit
// year is required, so ordinary subtitles ("Godzilla, King of the Monsters") are
// left alone. Registered and queried as a late key only.
const stripYearSubtitle = s => s.replace(/,\s*\d{4}\b.*$/, '').trim()

// Last resort: collapse a name to letters and digits only. Absorbs the ways
// vendors punctuate differently — '"I Would Like to Rage!"' vs the same without
// quotes, "The New # 1" vs "The New #1", "Happy-Go-Lucky" vs "Happy Go Lucky" —
// and the '$'-for-'s' typo the vendor ships on "Cardboard Crusader$". Only ever
// consulted when every sharper key has failed AND it yields exactly one card, so
// it can't quietly merge two real cards.
// '&' folds to "and" before punctuation is stripped: the card reads
// "Arrows & Daggers", the decklist says "Arrows And Daggers", and stripping
// first would leave "arrowsdaggers" vs "arrowsanddaggers".
const squash = s => norm(s).replace(/\$/g, 's').replace(/&/g, ' and ').replace(/[^a-z0-9]/g, '')

// Same idea, minus leading articles. The vendor drops them inconsistently:
// decklists say "Dwueth'var, Star Razor" where the card reads
// "Dwueth'var, the Star Razor". Also last-resort and unambiguous-only.
const squashNoStop = s => squash(String(s || '').replace(/\b(?:the|a|an)\b/gi, ' '))

// Query keys for one name, most specific first.
const keysFor = name => {
  const n = norm(name)
  return [...new Set([
    n, stripVariant(n), frontFace(n), stripVariant(frontFace(n)), stripYearSubtitle(n),
  ].filter(Boolean))]
}

// ── load our cards ───────────────────────────────────────────────────────────
const ours = []
for (const f of CARD_FILES) {
  const rows = JSON.parse(fs.readFileSync(p('src', 'assets', f), 'utf8'))
  for (const c of rows) {
    const id = uvsId(c)
    if (!id) { console.warn(`  ! no canonical id: ${c.name} (${f})`); continue }
    const formats = c.formats || []
    ours.push({ id, name: c.name, set: cardSet(c), number: cardNumber(c), file: f, standard: formats.includes('standard'), legacy: formats.includes('legacy') })
  }
}

// id → record. First writer wins; duplicates are the 8 known 4pointpromo image
// collisions, reported below so a new one can't slip in unnoticed.
const byId = new Map()
const idCollisions = []
for (const c of ours) {
  if (byId.has(c.id)) idCollisions.push({ id: c.id, kept: byId.get(c.id).name, dropped: c.name, file: c.file })
  else byId.set(c.id, c)
}

// name key → [records] (our cards only; the shipped byName index is built later)
const ourByName = new Map()
for (const c of ours) {
  for (const k of keysFor(c.name)) {
    if (!ourByName.has(k)) ourByName.set(k, [])
    const bucket = ourByName.get(k)
    if (!bucket.includes(c)) bucket.push(c)
  }
}

// squashed key → [records], for the last-resort passes
const bySquash = new Map()
const byNoStop = new Map()
const addTo = (map, k, c) => {
  if (!k) return
  if (!map.has(k)) map.set(k, [])
  if (!map.get(k).includes(c)) map.get(k).push(c)
}
for (const c of ours) {
  addTo(bySquash, squash(c.name), c)
  addTo(byNoStop, squashNoStop(c.name), c)
}

// ── load the vendor catalog ──────────────────────────────────────────────────
const catPath = p('data', 'hydra-uvs-catalog.json')
if (!fs.existsSync(catPath)) {
  console.error(`missing ${catPath}\nrun: node scripts/fetch-hydra-catalog.mjs`)
  process.exit(1)
}
const catalog = JSON.parse(fs.readFileSync(catPath, 'utf8'))

// ── pass 1: unambiguous names, and learn set affinity ────────────────────────
const resolved = new Map()          // hydra card id → our record
const affinity = new Map()          // hydra set → Map(our set → votes)
const vote = (hset, oset) => {
  if (!affinity.has(hset)) affinity.set(hset, new Map())
  const m = affinity.get(hset)
  m.set(oset, (m.get(oset) || 0) + 1)
}

const candidatesFor = c => {
  for (const k of keysFor(c.name)) {
    const hit = ourByName.get(k)
    if (hit?.length) return hit
  }
  // punctuation-insensitive, and only when it is unambiguous
  for (const k of [squash(c.name), squash(frontFace(c.name))]) {
    const hit = k && bySquash.get(k)
    if (hit?.length === 1) return hit
  }
  for (const k of [squashNoStop(c.name), squashNoStop(frontFace(c.name))]) {
    const hit = k && byNoStop.get(k)
    if (hit?.length === 1) return hit
  }
  return []
}

for (const c of catalog) {
  const cands = candidatesFor(c)
  if (cands.length === 1) {
    resolved.set(c.id, cands[0])
    vote(c.cardSet, cands[0].set)
  }
}

// ── pass 2: break ties with affinity, then collector number ──────────────────
const ambiguous = []
const unresolved = []
for (const c of catalog) {
  if (resolved.has(c.id)) continue
  const cands = candidatesFor(c)
  if (!cands.length) {
    unresolved.push({ hydraId: c.id, name: c.name, set: c.cardSet, number: c.collectorNumber })
    continue
  }
  const aff = affinity.get(c.cardSet) || new Map()
  const ranked = [...cands].sort((a, b) => {
    const av = aff.get(a.set) || 0, bv = aff.get(b.set) || 0
    if (av !== bv) return bv - av                                   // strongest set affinity
    const an = a.number === c.collectorNumber ? 1 : 0
    const bn = b.number === c.collectorNumber ? 1 : 0
    if (an !== bn) return bn - an                                   // then exact collector number
    if (a.standard !== b.standard) return a.standard ? -1 : 1       // then prefer standard-legal
    return a.id.localeCompare(b.id)                                 // stable
  })
  const top = ranked[0]
  const topScore = aff.get(top.set) || 0
  const tied = ranked.filter(r => (aff.get(r.set) || 0) === topScore && r.number !== c.collectorNumber).length > 1
  resolved.set(c.id, top)
  if (tied) ambiguous.push({ hydraId: c.id, name: c.name, set: c.cardSet, chose: top.id, over: ranked.slice(1, 4).map(r => r.id) })
}

// ── emit ─────────────────────────────────────────────────────────────────────
const byHydraId = {}
const byCardeioId = {}
for (const c of catalog) {
  const hit = resolved.get(c.id)
  if (!hit) continue
  byHydraId[c.id] = hit.id
  // externalId is the same card's legacy carde.io ObjectId. Newer sets use a
  // collector code ("TK802-049") there instead; only keep real ObjectIds, since
  // that is the shape the legacy deck payloads actually reference.
  if (c.externalId && /^[0-9a-f]{24}$/.test(c.externalId)) byCardeioId[c.externalId] = hit.id
}

// cardeio-ids.json carries ObjectIds the current catalog has dropped (delisted
// printings that historical decks still reference). Fold those in by name so
// old decklists keep resolving.
const legacyIds = JSON.parse(fs.readFileSync(p('src', 'assets', 'cardeio-ids.json'), 'utf8'))
let fromLegacy = 0
for (const [id, data] of Object.entries(legacyIds)) {
  if (byCardeioId[id]) continue
  const cands = candidatesFor({ name: data.name })
  if (cands.length === 1) { byCardeioId[id] = cands[0].id; fromLegacy++ }
}

// ── name index ───────────────────────────────────────────────────────────────
// The decklist markdown under lc-round*/ and regionals/ is the ingest source of
// truth and stores card NAMES only — it is hand-edited, so it stays that way.
// Those names were written from the vendor's spelling, which is precisely what
// this crosswalk has just finished mapping. So publish the vendor spellings as
// lookup keys and gen-locals can resolve markdown to canonical ids without the
// markdown format changing at all.
//
// Keys are registered from both sides (vendor name and our name) under norm()
// and squash(). A key that would point at two different cards is dropped, not
// guessed — ambiguity belongs in the report, not in the shipped table.
const nameVotes = new Map()   // key → Set(uvsId)
const addKey = (k, id) => {
  if (!k) return
  if (!nameVotes.has(k)) nameVotes.set(k, new Set())
  nameVotes.get(k).add(id)
}
for (const c of catalog) {
  const hit = resolved.get(c.id)
  if (!hit) continue
  for (const k of keysFor(c.name)) addKey(k, hit.id)
  addKey(squash(c.name), hit.id)
  addKey(squashNoStop(c.name), hit.id)
}
for (const c of ours) {
  for (const k of keysFor(c.name)) addKey(k, c.id)
  addKey(squash(c.name), c.id)
  addKey(squashNoStop(c.name), c.id)
}
// A name key pointing at several ids is usually a genuine cross-era reprint:
// "Syndicate Target" is both cb02-020 (standard) and bebop-090 (retro-only),
// "Eri" is both mha07-195 (standard) and mha05-122 (legacy). Dropping those keys
// stranded ~7% of all decklist copies, because the markdown only has the name.
//
// Format legality breaks the tie cleanly and in the direction every consumer
// already wants: decklists are Standard events and /lists filters on the
// standard-only pool, so the standard-legal printing is the one meant. Rank
// standard > legacy > everything else and take a strict winner; a tie *within*
// the top tier is a real ambiguity and is reported instead of guessed.
// Cards the live game recognises outrank ones it does not: "Basic Training" is
// both mha03-109 and warriorsofthenight-014, genuinely different cards from
// different games that happen to share a name, and only the first is a
// UniVersus-era printing the vendor catalog carries.
const inCatalog = new Set(Object.values(byHydraId))
const setSize = new Map()
for (const c of ours) setSize.set(c.set, (setSize.get(c.set) || 0) + 1)

const rank = id => {
  const c = byId.get(id)
  if (!c) return -1
  return (c.standard ? 8 : c.legacy ? 4 : 0) + (inCatalog.has(id) ? 2 : 0)
}
const byName = {}
const nameConflicts = []
for (const [k, set] of nameVotes) {
  const ids = [...set]
  if (ids.length === 1) { byName[k] = ids[0]; continue }
  const top = Math.max(...ids.map(rank))
  const winners = ids.filter(i => rank(i) === top)
  if (winners.length === 1) {
    byName[k] = winners[0]
    nameConflicts.push({ key: k, ids, chose: winners[0], by: 'format-legality' })
    continue
  }
  // Still tied: these are the same card printed twice at the same legality —
  // "History's Greatest Monster" in both gdz01 and the cha03gmm challenger deck,
  // "Sung Jinwoo, E Rank Hunter" in both sl01 and sleb. Functionally one card, so
  // collapsing them is correct; prefer the printing from the larger set, which is
  // the main release rather than the challenger/bundle reprint, and keeps the
  // choice stable as new sets land.
  const best = winners.slice().sort((a, b) => {
    const d = (setSize.get(parseUvsSet(b)) || 0) - (setSize.get(parseUvsSet(a)) || 0)
    return d !== 0 ? d : a.localeCompare(b)
  })[0]
  byName[k] = best
  nameConflicts.push({ key: k, ids, chose: best, by: 'reprint-set-size' })
}

// Hand-curated mappings for names no rule could derive — a reskin promo whose
// art we don't hold, and anything else that is genuinely one card wearing two
// names. Applied last so an override always wins, and reported so the table
// stays reviewable.
// Lives in src/assets rather than data/ because it is hand-authored curation
// input, not build output — and data/ is gitignored, so it would not survive a
// fresh clone. Sits beside the crosswalk it feeds; nothing imports it at runtime.
const overridesFile = p('src', 'assets', 'card-name-overrides.json')
const overrideApplied = []
if (fs.existsSync(overridesFile)) {
  const { overrides = {} } = JSON.parse(fs.readFileSync(overridesFile, 'utf8'))
  for (const [key, { uvsId: id, why }] of Object.entries(overrides)) {
    const k = norm(key)
    if (!byId.has(id)) { console.warn(`  ! override "${key}" targets unknown id ${id}`); continue }
    byName[k] = id
    byName[squash(k)] = id

    // Carry the override onto the vendor-id maps too. A decklist scraped from
    // the API arrives as an id, never a name, so a name-only override would fix
    // the markdown path and leave the id path still unresolved.
    let ids = 0
    for (const c of catalog) {
      if (norm(c.name) !== k) continue
      byHydraId[c.id] = id
      if (/^[0-9a-f]{24}$/.test(c.externalId || '')) byCardeioId[c.externalId] = id
      ids++
    }
    for (const [legacyId, data] of Object.entries(legacyIds)) {
      if (norm(data.name) === k) { byCardeioId[legacyId] = id; ids++ }
    }
    overrideApplied.push({ key: k, uvsId: id, why, vendorIdsMapped: ids })
  }
}

const out = {
  _generated: new Date().toISOString(),
  _source: 'data/hydra-uvs-catalog.json + src/assets/cardeio-ids.json',
  _note: 'vendor card id → canonical uvsId. Built by scripts/build-card-crosswalk.mjs; do not hand-edit.',
  byHydraId,
  byCardeioId,
  byName,
}
fs.writeFileSync(p('src', 'assets', 'card-crosswalk.json'), JSON.stringify(out, null, 0) + '\n')

const report = { generated: out._generated, counts: { ourCards: ours.length, catalog: catalog.length, resolved: resolved.size, byHydraId: Object.keys(byHydraId).length, byCardeioId: Object.keys(byCardeioId).length, byName: Object.keys(byName).length, fromLegacyNames: fromLegacy }, idCollisions, ambiguous, unresolved, nameConflicts, overrideApplied }
fs.mkdirSync(p('data'), { recursive: true })
fs.writeFileSync(p('data', 'card-crosswalk-report.json'), JSON.stringify(report, null, 2))

console.log(`our cards        ${ours.length}  (${byId.size} distinct ids, ${idCollisions.length} image-path collisions)`)
console.log(`hydra catalog    ${catalog.length}`)
console.log(`resolved         ${resolved.size}/${catalog.length}  (${Math.round(100 * resolved.size / catalog.length)}%)`)
console.log(`  byHydraId      ${Object.keys(byHydraId).length}`)
console.log(`  byCardeioId    ${Object.keys(byCardeioId).length}  (+${fromLegacy} recovered from cardeio-ids.json)`)
const byFmt = nameConflicts.filter(c => c.by === 'format-legality').length
const byRep = nameConflicts.filter(c => c.by === 'reprint-set-size').length
console.log(`byName keys      ${Object.keys(byName).length}  (${byFmt} by format, ${byRep} reprint collapses)`)
console.log(`overrides        ${overrideApplied.length}`)
console.log(`ambiguous        ${ambiguous.length}   unresolved ${unresolved.length}`)
console.log(`\nreport: data/card-crosswalk-report.json`)
if (unresolved.length) {
  console.log('\nunresolved (first 20):')
  for (const u of unresolved.slice(0, 20)) console.log(`  ${u.set}/${u.number}  ${u.name}`)
}
