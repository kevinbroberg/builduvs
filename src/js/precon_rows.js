// The /precons product list: which preconstructed products exist, and the
// decklist (official, community or inferred) each one maps to. Shared by the
// page (src/pages/PreconsPage.vue) and the Tabletop Simulator manifest
// (scripts/gen-tts-manifest.mjs), so the importer offers exactly the decks the
// page shows. Dependency-free so plain Node can import it; the caller passes
// the JSON in.

/**
 * @param {object} data  the parsed src/assets JSON
 * @param {object} data.releaseData     releases.json
 * @param {object} data.derivedData     precons-derived.json
 * @param {object} data.officialDecks   official-decks.json
 * @param {object} data.communityDecks  precon-decks-uvsultra.json
 * @param {object} data.inferredDecks   precon-decks-inferred.json
 * @returns {{ decks: object[], rows: object[] }} every decklist, in sections and
 *   tagged with its provenance; and the product rows, each with its `deck` or null
 */
export function buildPrecons({ releaseData, derivedData, officialDecks, communityDecks, inferredDecks }) {
  // Two decklist sources with different shapes: UVS's official lists arrive in
  // sections, the community transcriptions as one flat card array. Normalise to
  // sections so the deck view doesn't care which it got.
  const asSections = d => {
    if (d.sections) return d
    const chars = d.cards.filter(c => c.type === 'character')
    const rest = d.cards.filter(c => c.type !== 'character')
    return {
      ...d,
      sections: [
        { name: 'character', cards: chars },
        { name: 'main', cards: rest },
        { name: 'sideboard', cards: [] },
      ],
    }
  }

  const allDecks = [
    ...officialDecks.entries.map(d => ({ ...asSections(d), provenance: 'official' })),
    ...communityDecks.entries.map(d => ({ ...asSections(d), provenance: 'community' })),
    ...inferredDecks.entries.map(d => ({ ...d, provenance: 'inferred' })),
  ]

  // Community lists are keyed by set + character rather than a product title.
  const loose = n => (n || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\d+$/, '').trim()
  function communityDeckFor(extShort, characters) {
    const community = allDecks.filter(d => d.provenance === 'community')
    // Heroes Clash carries no extension_short in our card data, so fall back to
    // matching on the character alone when there's no set code to narrow by.
    const pool = extShort
      ? community.filter(d => d.extensionShort === extShort)
      : community
    for (const ch of characters ?? []) {
      const hit = pool.find(d =>
        loose(d.character) && (loose(d.character).includes(loose(ch)) || loose(ch).includes(loose(d.character))))
      if (hit) return hit
    }
    return null
  }

  // ── Matching products to their official decklist ─────────────────────────────

  // Roster titles and UGN deck titles order the same words differently
  // ("Star Trek: Lower Decks Beckett Mariner Challenger Series" vs "Star Trek:
  // Lower Decks Challenger Series - Beckett Mariner"), so match on token
  // containment: every distinctive word of the product title must appear in the
  // deck title. One-way containment leaves near-misses unmatched rather than wrong.
  const GENERIC = new Set(['the', 'of', 'and', 'a', 'ccg', 'universus', 'uvs'])
  const words = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')
    .filter(w => w && w.length > 1 && !GENERIC.has(w))

  // Where the two names share almost no vocabulary, tokens can't bridge it. Each
  // of these was checked by hand against the deck's character card.
  const DECK_ALIAS = {
    'GMM': 'Godzilla Challenger Series - Godzilla',
    'KRM': 'Godzilla Challenger Series - Ghidorah',
    'AOTC01': 'Attack on Titan Challenger Series',
    'MHA08': 'My Hero Academia Challenger Series - Izuku Midoriya',
    'CR03': 'Critical Role Starter Deck: Beauregard Lionett',
    'CR04': 'Critical Role Starter Deck: Percival de Rolo III',
    'SF602': 'Street Fighter 6 Challenger Series - Chun-Li & Jamie',
    'TK801-CD1': 'Tekken 8 Clash - Jin Kazama',
    'TK801-CD2': 'Tekken 8 Clash - Jun Kazama',
  }

  function officialFor(name, setCode) {
    const alias = setCode && DECK_ALIAS[setCode]
    if (alias) return officialDecks.entries.find(d => d.name === alias) ?? null
    const want = words(name)
    if (want.length < 2) return null
    return officialDecks.entries.find(d => {
      const have = new Set(words(d.name))
      return want.every(w => have.has(w))
    }) ?? null
  }

  // Roster products can also have a community list rather than an official one
  // (the King of Fighters challengers, the AoT clash decks). Two ways in: the
  // deck's own name sits inside the product title ("Team Hero" in "King of
  // Fighters XV: Team Hero Challenger Series"), or the deck's character does
  // ("Levi Ackerman" in "Levi Ackerman Clash Deck").
  function communityForProduct(title, setCode) {
    const have = new Set(words(title))
    const pool = allDecks.filter(d => d.provenance === 'community')
    const bare = n => (n || '').split(',')[0]

    const candidates = pool.filter(d => {
      const byName = words(d.name)
      if (byName.length >= 2 && byName.every(x => have.has(x))) return true
      const byChar = words(bare(d.character))
      return byChar.length >= 2 && byChar.every(x => have.has(x))
    })
    if (!candidates.length) return null

    // A character can headline decks in different sets years apart — "All For
    // One" is both a 2023 League of Villains clash deck and the 2026 Final War
    // Arc one — so prefer a candidate from the product's own set. The set codes
    // don't always agree exactly (KF01 vs the cards' kf0x), hence a prefix test
    // rather than equality, with the name match as the fallback.
    const prefix = (setCode ?? '').toLowerCase().replace(/[-_].*$/, '')
    const sameSet = candidates.find(d => (d.extensionShort ?? '').toLowerCase() === prefix)
    return sameSet ?? candidates[0] ?? null
  }

  // ── The product list ─────────────────────────────────────────────────────────

  // Preconstructed products are identified from their official product name (and
  // the -CS / -CD set-code suffixes, which the roster uses where the name alone
  // doesn't say "Challenger Series"). Everything not matching is a booster set,
  // a promo run, or a Blitz Box, and is left off this page.
  //
  // Experience Bundles are deliberately excluded: despite the deck-ish name they
  // are alt-art releases — reskins of existing cards, in the vein of the old Deck
  // Loadable Content — not preconstructed decks. Borderlands 4 is the clearest case.
  const KINDS = [
    { label: 'Challenger Series', color: 'primary',
      test: (n, c) => /Challenger Series/i.test(n) || /-CS\d/i.test(c) },
    { label: 'Clash Deck', color: 'deep-orange',
      test: (n, c) => /Clash (Starter )?Deck/i.test(n) || /-CD\d/i.test(c) },
    { label: 'Starter Deck', color: 'teal',
      test: n => /Starter Deck/i.test(n) },
  ]
  const kindOf = e => KINDS.find(k => k.test(e.name, e.setCode ?? '')) ?? null

  // Roster products (2024+) and card-derived products (pre-2024) are folded into
  // one list so the page reads as a single timeline regardless of where a row
  // came from. `inferred` marks the derived ones for the badge.
  const rosterRows = releaseData.entries
    .map(e => ({ ...e, kind: kindOf(e) }))
    .filter(e => e.kind)
    .map(e => ({
      key: `r:${e.setCode ?? e.name}`,
      code: e.setCode,
      title: e.name,
      kindLabel: e.kind.label,
      kindColor: e.kind.color,
      date: e.releaseDate,
      precision: e.releaseDate ? 'day' : null,
      source: e.releaseDateSource,
      inferred: false,
      deck: officialFor(e.name, e.setCode) ?? communityForProduct(e.name, e.setCode),
    }))

  const derivedRows = (() => {
    const bySet = new Map()
    for (const d of derivedData.entries) {
      if (!bySet.has(d.extension)) bySet.set(d.extension, { ...d, characters: [] })
      bySet.get(d.extension).characters.push(d)
    }

    const rows = []
    for (const s of bySet.values()) {
      // A set whose decks are already listed individually by the roster (the AoT
      // Levi / Mikasa Clash Decks) would otherwise appear twice — once per deck
      // from the roster and again as a set row here.
      if (s.characters.length && s.characters.every(c => c.knownProduct)) continue

      const base = {
        code: s.extensionShort,
        kindColor: 'brown-5',
        date: s.releaseDate,
        precision: s.releasePrecision,
        source: s.productSource ?? s.releaseDateSource,
        inferred: true,
        unnamed: !s.productName,
      }

      // One row per deck where the roster is known, so pre-2024 products read the
      // same way as modern ones: a row is a deck, not a boxed set.
      if (s.deckRoster?.length) {
        for (const deck of s.deckRoster) {
          const found = communityDeckFor(s.extensionShort, deck)
          rows.push({
            ...base,
            key: `d:${s.extension}:${deck.join('+')}`,
            title: deck.join(' + '),
            subtitle: s.productName ?? s.extension,
            kindLabel: found ? `${found.totalCards} cards` : 'contents not recorded',
            deck: found,
          })
        }
      } else {
        rows.push({
          ...base,
          key: `d:${s.extension}`,
          title: s.productName ?? s.extension,
          subtitle: s.productName ? s.extension : null,
          kindLabel: 'deck count unknown',
          deck: null,
        })
      }
    }
    return rows
  })()

  // Community lists for products no row covers yet (Penny Arcade has recorded
  // precons but no starter-exclusive cards to derive a product from).
  //
  // Community folders also hold transcriptions of decks UVS publishes officially
  // — a whole "challenger decks" folder mirrors most of the official list — so
  // drop any whose character is already on a row that has a deck. The official
  // list wins; a second row for the same physical deck is noise.
  // Key on the FULL character name, subtitle included. The bare name repeats
  // across eras — "All For One" headlines both the 2023 League of Villains clash
  // deck and the 2026 Final War Arc one — while the subtitle separates them
  // ("All For One" vs "All For One, Demon Lord"). Set codes can't do this job:
  // the same printing is filed under sl01 by UVSUltra and sleb by our own data.
  const deckKey = d => loose(d.character ?? '')

  const claimed = new Set(
    [...rosterRows, ...derivedRows].map(r => r.deck).filter(Boolean).map(deckKey))

  const orphanRows = allDecks
    .filter(d => d.provenance === 'community')
    .filter(d => ![...rosterRows, ...derivedRows].some(r => r.deck?.id === d.id))
    .filter(d => !claimed.has(deckKey(d)))
    .map(d => ({
      key: `c:${d.id}`,
      code: d.extensionShort,
      title: d.name,
      subtitle: d.character,
      kindLabel: `${d.totalCards} cards`,
      kindColor: 'brown-5',
      date: null,
      precision: null,
      source: d.url,
      inferred: true,
      deck: d,
    }))

  // Decks built from the rarity rule (scripts/derive-challenger-decks.mjs) for
  // products UVS hasn't published a list for yet. Each stands aside the moment
  // an official list for the same character turns up, so a later
  // fetch-official-decks run supersedes it with nothing to clean up here.
  const officialChars = new Set(allDecks.filter(d => d.provenance === 'official').map(deckKey))
  const inferredRows = allDecks
    .filter(d => d.provenance === 'inferred' && !officialChars.has(deckKey(d)))
    .map(d => ({
      key: `i:${d.id}`,
      code: d.extensionShort,
      title: d.name,
      kindLabel: 'Challenger Series · quantities inferred',
      kindColor: 'primary',
      date: d.releaseDate,
      precision: 'day',
      source: d.source,
      inferred: true,
      deck: d,
    }))

  const allRows = [...rosterRows, ...derivedRows, ...orphanRows, ...inferredRows]

  return { decks: allDecks, rows: allRows }
}
