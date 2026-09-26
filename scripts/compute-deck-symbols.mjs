/**
 * Computes the "deck main symbol" and overall record for each standing and
 * writes them into the target index JSON.
 *
 * Algorithm: take the face card's resources (excluding infinity/-attune),
 * then iterate through main-deck cards to find the first face resource that
 * appears on any deck card. That shared symbol is the deck's main symbol.
 *
 * Usage:
 *   node scripts/compute-deck-symbols.mjs           # /lists  (default)
 *   node scripts/compute-deck-symbols.mjs majors    # /majors
 *
 * Both indexes get these fields stripped by their generator (gen-locals.mjs /
 * gen-majors.mjs), so this must run after them.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { normName, lookupKeys, buildNameIndex, stripVariantSuffix } from '../src/js/card_name_match.js'
import { uvsId } from '../src/js/card_id.js'
import { CONFUSED_SYMBOL } from '../src/js/deck_symbol.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ── Target ──────────────────────────────────────────────────────────────────
// The two datasets differ in which printings they may resolve against. /lists
// covers current-format events, so standard-only keeps lookups unambiguous.
// Majors reach back to 2024, where most of the field has since rotated out —
// only ~2.4k of ~9.9k printings are standard-legal — so it must see every
// printing or most historical faces and deck cards would not resolve at all.
const TARGETS = {
  locals: {
    index: 'locals-index.json', players: 'locals-players.json',
    standardOnly: true, route: 'lists', useFaceOverrides: true,
    // Historically gated on deckName; kept as-is so /lists output is unchanged.
    skip: s => !s.deckName,
  },
  majors: {
    index: 'majors-index.json', players: 'majors-players.json',
    standardOnly: false, route: 'majors', useFaceOverrides: false,
    // hasDeck is the accurate gate — an unnamed list is still a list.
    skip: s => !s.hasDeck,
  },
}

const targetName = process.argv[2] ?? 'locals'
const target = TARGETS[targetName]
if (!target) {
  console.error(`Unknown target "${targetName}". Expected one of: ${Object.keys(TARGETS).join(', ')}`)
  process.exit(1)
}

// ── Load all card JSON files (mirroring card_provider.js) ────────────────────

const assetDir = path.join(root, 'src', 'assets')
const cardFiles = [
  'tekken8.json', 'mha09.json', 'kaiju.json', 'teamhero.json', 'gg-critrole.json',
  'sjw-mha4.json', 'heroesclash.json', 'rampage_dlc.json', 'provs.json',
  'rampage.json', 'cards.json',
]
const loadedCards = cardFiles
  .flatMap(f => JSON.parse(fs.readFileSync(path.join(assetDir, f), 'utf8')))
const standardCards = loadedCards.filter(c => c.formats?.includes('standard'))
const allCards = target.standardOnly ? standardCards : loadedCards

// Across the full pool one name can hit several printings. Seed with the pool,
// then let standard-legal printings win the exact key, so a card still in
// rotation resolves to its current printing and everything else falls back to
// whatever exists. (Reprints share resources, so this only affects which
// art/flags are read.)
//
// buildNameIndex registers exact names first, then diacritic-folded aliases, so
// an alias can never displace a real card — the DB has both "Ryukyu"
// (earth/life/all) and "Ryukyu (II)" (air/earth/order), and the wrong one
// winning the "ryukyu" key silently scores decks against the wrong symbols.
// Variant-suffix stripping happens on the query side in findCard.
const cardByName = buildNameIndex(allCards)
if (!target.standardOnly) for (const c of standardCards) cardByName.set(normName(c.name), c)

// Canonical id → card. This is the join that should win: it is exact, it is
// written on 100% of deck rows by gen-locals/gen-majors, and it distinguishes
// printings that share a name. Getting the printing wrong here is not cosmetic —
// symbols are read off the resolved card, so the wrong "Ryukyu" scores the deck
// against the wrong symbol pool. See src/js/card_id.js.
const cardByUvsId = new Map(allCards.filter(c => uvsId(c)).map(c => [uvsId(c), c]))

const cardeioIds = JSON.parse(fs.readFileSync(path.join(assetDir, 'cardeio-ids.json'), 'utf8'))
const cardByCardeioId = new Map(
  Object.entries(cardeioIds)
    .map(([id, data]) => [id, cardByName.get(normName(data.name))])
    .filter(([, card]) => card != null)
)

// Force specific character lookups where card data has stale standard tags.
// Only needed for the standard-only pool — with every printing visible the
// cardeioId join already lands on the right variant, so majors skips these.
const FACE_OVERRIDES = new Map([
  ['mt. lady',    'mt. lady (iii)'],
  ['mei hatsume', 'mei hatsume (ii)'],
])

function findCard(nameOrId, cardeioId, uvs) {
  if (!nameOrId) return null
  let n = normName(nameOrId)
  const overridden = target.useFaceOverrides ? FACE_OVERRIDES.get(n) : undefined
  if (!overridden && uvs) {
    const c = cardByUvsId.get(uvs)
    // Respect the pool: on the standard-only target a uvsId pointing at a
    // rotated-out printing must fall through to the name path, which lands on
    // the printing that is actually legal.
    if (c && (!target.standardOnly || c.formats?.includes('standard'))) return c
  }
  if (!overridden && cardeioId) {
    const c = cardByCardeioId.get(cardeioId)
    if (c) return c
  }
  if (overridden) n = overridden
  for (const k of lookupKeys(n)) {
    const c = cardByName.get(k)
    if (c) return c
  }
  let card
  if (n.includes(' // ')) {
    const front = n.split(' // ')[0].trim()
    for (const k of lookupKeys(front)) {
      const c = cardByName.get(k)
      if (c) return c
    }
  }
  const yearStripped = n.replace(/,\s*\d{4}.*/, '').trim()
  if (yearStripped !== n) {
    card = cardByName.get(yearStripped)
    if (card) return card
  }
  if (n.includes('$')) {
    card = cardByName.get(n.replaceAll('$', 's'))
    if (card) return card
  }
  return null
}

// ── Load target data ──────────────────────────────────────────────────────────

const indexPath   = path.join(assetDir, target.index)
const playersPath = path.join(assetDir, target.players)

const index   = JSON.parse(fs.readFileSync(indexPath,   'utf8'))
const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'))

// ── Compute deck main symbol ──────────────────────────────────────────────────

const EXCLUDED = new Set(['infinity'])

// Decks that mix hard symbols — illegal under UVS deckbuilding rules. Collected
// so the run ends with a report you can act on rather than scattered warnings.
const illegalDecks = []

// Resources are printed either bare ("evil") or attuned ("evil-attuned").
const baseSymbol = r => r.replace(/-attuned$/, '')

/**
 * Matches a card's resources against the face's symbols.
 *
 * Attuned symbols DO match, so a card is recognised as linking through every
 * symbol it really shares with the face. But an attuned symbol is not evidence
 * of deck identity on its own: attuned cards slot into any deck, so a card
 * whose only link is attuned says nothing about the deck's main symbol.
 *
 * Returns Map<symbol, matchedViaBareSymbol>.
 */
function faceMatches(resources, faceSet) {
  const matched = new Map()
  for (const r of resources) {
    if (EXCLUDED.has(r)) continue
    const base = baseSymbol(r)
    if (EXCLUDED.has(base) || !faceSet.has(base)) continue
    matched.set(base, (matched.get(base) ?? false) || base === r)
  }
  return matched
}

// Every printing whose variant-suffix-stripped name matches this one's — e.g.
// "Mt. Lady" and "Mt. Lady (III)". A decklist names a character without
// reliably identifying which printing was played, and different printings have
// different symbols, so the right one has to be inferred (see pickFace).
function printingsOf(name) {
  const wanted = stripVariantSuffix(normName(name))
  return allCards.filter(c => c.resources?.length &&
    stripVariantSuffix(normName(c.name)) === wanted)
}

/**
 * Copies in the main deck that share NO symbol with this face and aren't "all".
 *
 * Used ONLY to compare candidate printings of the same character against each
 * other, where it is decisive: a Mt. Lady deck scores 0 off-pool as
 * "Mt. Lady (III)" and 25 as plain "Mt. Lady", which settles which printing was
 * played, and beats the hardcoded FACE_OVERRIDES list at the same job.
 *
 * It is NOT a usable absolute legality test — run across the whole dataset it
 * flags ~52% of decks, so the card data is not clean enough to support that
 * reading. Only trust the relative comparison.
 */
function offPoolCopies(mainCards, faceSet) {
  let n = 0
  for (const dc of mainCards) {
    const card = findCard(dc.name, dc.cardeioId, dc.uvsId)
    if (!card?.resources) continue
    const res = card.resources.map(baseSymbol)
    if (!res.includes('all') && !res.some(r => faceSet.has(r))) n += dc.qty
  }
  return n
}

const faceSymbolsOf = card => [...new Set(
  (card.resources ?? []).map(baseSymbol).filter(r => !EXCLUDED.has(r))
)]

// Score a deck against one candidate printing of its face.
function scoreFace(card, mainCards) {
  const syms = faceSymbolsOf(card)
  if (!syms.length) return null
  const faceSet = new Set(syms)
  const singleLinkCount = new Map(syms.map(r => [r, 0]))
  for (const dc of mainCards) {
    const c = findCard(dc.name, dc.cardeioId, dc.uvsId)
    if (!c?.resources) continue
    const matched = faceMatches(c.resources, faceSet)
    if (matched.size !== 1) continue
    const [[symbol, viaBareSymbol]] = [...matched]
    if (!viaBareSymbol) continue
    singleLinkCount.set(symbol, (singleLinkCount.get(symbol) ?? 0) + dc.qty)
  }
  const active = syms.filter(r => (singleLinkCount.get(r) ?? 0) > 0)
  return { card, syms, faceSet, singleLinkCount, active, offPool: offPoolCopies(mainCards, faceSet) }
}

// A decklist names a character but doesn't reliably say which printing was
// played, and printings differ in symbols. The cardeioId recorded by carde.io
// is the authoritative answer, so trust it whenever it yields a coherent deck.
//
// Only when the direct printing is demonstrably wrong — off-pool cards, or
// mixed hard symbols — is an alternate printing considered, and then only if it
// is strictly better. That ordering matters: several printings can tie at zero
// off-pool (cards carrying "all" are legal under any face), so preferring the
// direct match is what keeps e.g. a "Ryukyu" (earth/life/all) deck from being
// rescored against "Ryukyu (II)" (air/earth/order) and falsely called illegal.
const isClean = s => s && s.offPool === 0 && s.active.length <= 1

function pickFace(faceEntry, mainCards) {
  const direct = findCard(faceEntry.name, faceEntry.cardeioId, faceEntry.uvsId)
  const directScore = direct ? scoreFace(direct, mainCards) : null
  if (isClean(directScore)) return directScore

  const alternates = printingsOf(faceEntry.name)
    .filter(c => c !== direct)
    .map(c => scoreFace(c, mainCards))
    .filter(Boolean)
    .sort((a, b) => a.offPool - b.offPool || a.active.length - b.active.length)

  const best = alternates[0]
  if (!best) return directScore
  if (!directScore) return best
  // Switch only on a strict improvement in legality.
  const better = best.offPool < directScore.offPool ||
    (best.offPool === directScore.offPool && best.active.length < directScore.active.length)
  return better ? best : directScore
}

function deckMainSymbol(standingId, eventId, standingNum) {
  const deckCards = players.cards[standingId] || []

  const faceEntry = deckCards.find(c => c.section === 'character')
  if (!faceEntry) return null

  const mainCards = deckCards.filter(c => c.section === 'main')
  const picked = pickFace(faceEntry, mainCards)
  if (!picked) return null

  // scoreFace already did the single-link pass for the chosen printing: for each
  // face resource, how many card copies link to the face through that symbol
  // alone (intersection size === 1). The symbol with single-link copies is the
  // deck's defining symbol.
  const { syms: faceResources, faceSet, singleLinkCount, active: activeSingleLinks } = picked

  // A legal deck has exactly one hard symbol. More than one means the player
  // built an illegal deck — mixing hard symbols is not allowed — so this is a
  // genuine rules violation the event software failed to catch, not merely an
  // inconclusive read. (Before flagging, pickFace has already ruled out the
  // most common false positive: scoring the deck against the wrong printing of
  // the character.)
  if (activeSingleLinks.length > 1) {
    const detail = activeSingleLinks.map(r => `${r}(${singleLinkCount.get(r)})`).join(', ')
    const offPool = offPoolCopies(mainCards, faceSet)
    illegalDecks.push({
      route: `/${target.route}/${eventId}/${standingNum}`,
      face: picked.card.name, detail, offPool,
    })
    // NOT 'infinity' — that is a real printed resource, so reusing it made an
    // illegal deck indistinguishable from a genuine infinity deck.
    return CONFUSED_SYMBOL
  }

  if (activeSingleLinks.length === 1) return activeSingleLinks[0]

  // Fallback: first face resource present on any deck card
  const deckResourceSet = new Set(
    mainCards
      .flatMap(dc => (findCard(dc.name, dc.cardeioId, dc.uvsId)?.resources || []))
      .map(baseSymbol)
      .filter(r => !EXCLUDED.has(r))
  )
  return faceResources.find(r => deckResourceSet.has(r)) ?? null
}

function overallRecord(standingId) {
  const matches = players.matches[standingId]
  if (!matches?.length) return null
  let w = 0, l = 0, d = 0
  for (const m of matches) {
    if (m.result?.startsWith('W')) w++
    else if (m.result?.startsWith('L')) l++
    else if (m.result?.startsWith('D')) d++
  }
  if (w + l + d === 0) return null
  return `${w}-${l}-${d}`
}

// ── Annotate standings in the index ──────────────────────────────────────────

let computed = 0
let skipped  = 0

for (const [, eventStandings] of Object.entries(index.standings)) {
  for (const standing of eventStandings) {
    const rec = overallRecord(standing.id)
    if (rec) standing.overallRecord = rec

    if (target.skip(standing)) { skipped++; continue }
    const symbol = deckMainSymbol(standing.id, standing.eventId, standing.standing)
    if (symbol) {
      standing.deckSymbol = symbol
      computed++
    } else {
      skipped++
    }
  }
}

fs.writeFileSync(indexPath, JSON.stringify(index))
console.log(`Done (${targetName}). ${computed} symbols computed, ${skipped} standings skipped.`)

if (illegalDecks.length) {
  console.warn(`\n${illegalDecks.length} deck(s) mix hard symbols (illegal — flagged '${CONFUSED_SYMBOL}'):`)
  for (const d of illegalDecks) {
    const off = d.offPool ? `, ${d.offPool} off-pool` : ''
    console.warn(`  ${d.route}  ${d.face}: ${d.detail}${off}`)
  }
}
