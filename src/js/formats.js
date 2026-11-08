// Constructed formats, narrowest to widest. Each one's card pool contains the
// one before it (uvsgames.com/news/formats-and-ban-lists):
//   Standard — sets from the current year and the two before it.
//   Hero Too — My Hero Academia Booster Set 1 onward.
//   Retro    — every card that has been part of UniVersus (the Jasco era on).
//   Legacy   — anything ever printed, back to the Sabertooth-era UFS sets.
// Bans are not considered: this is about which sets a deck draws from.
import { cardSet } from 'src/js/card_id'

export const FORMATS = ['standard', 'heroToo', 'retro', 'legacy']

export const FORMAT_LABELS = {
  standard: 'Standard',
  heroToo: 'Hero Too',
  retro: 'Retro',
  legacy: 'Legacy',
}

// The narrowest format each set is legal in, keyed by cardSet() code. Sets not
// listed are Legacy. Hand-maintained: add each new set here, and move the oldest
// Standard sets down to heroToo at rotation (each January).
const SETS_BY_FORMAT = {
  standard: [
    'ft01', 'sf62x', 'tk802', 'mha09', 'gdz01', 'kf0x', 'promo2026', 'ggs01', 'sleb',
    'tmnt01', 'sf60x', 'aot03', 'cr02', 'promo2025', 'sl01', 'stk0x', 'aot02', 'tk801',
    'mha08', 'aot01', 'cha03gmm', 'cha03krm', 'mha07', 'promo2024', 'crvm', 'crmn',
    'yyhdt', 'cb02', 'ts01',
  ],
  heroToo: [
    'mha06', 'promo2023', 'mha05', 'mha04', 'mha03', 'mha_dlc2', 'mha02', 'mha01',
  ],
  retro: [
    '2020promo', 'dlc', 'libra', 'yyh', 'championpromos5', '7thcross', 'soulcalibur6',
    'ptcpromos', 'capcomleaguekit', 'sfvdarkstarlkers2018', 'mortalkombat', 'bebop',
    'platinum', 'championpromos4', 'sf5', 'sfvdarkstalkers', 'grimmpromo', 'bloodomen',
    'battleforpower', 'championpromos3', 'indines', 'championpromos2',
    'warriorsofthenight', 'riseofmasters', 'unmarkedpromo', 'rh4p', 'darkstalkerstin',
    'megaman', 'neomax', 'rot', '2013champions', 'kofxiii', 'tov', 'redhorizon',
    '6pointpromo',
  ],
}

const FORMAT_BY_SET = new Map(
  Object.entries(SETS_BY_FORMAT).flatMap(([format, sets]) => sets.map(s => [s, format])))

const rank = format => FORMATS.indexOf(format)

// One printing's format, from its set. A set missing from the table falls back
// to its `standard` tag, so a freshly scraped set isn't read as Legacy before
// it has been added above.
export function printingFormat(card) {
  const mapped = FORMAT_BY_SET.get(cardSet(card))
  if (mapped) return mapped
  return card.formats?.includes('standard') ? 'standard' : 'legacy'
}

/**
 * Indexes `cards` and returns formatOf(card): the narrowest format the card is
 * legal in. Judged by name across every printing, since a reprint makes the
 * older printings legal wherever the new one is.
 */
export function buildFormatIndex(cards) {
  const byName = new Map()
  for (const c of cards) {
    const f = printingFormat(c)
    const prev = byName.get(c.name)
    if (!prev || rank(f) < rank(prev)) byName.set(c.name, f)
  }
  return card => byName.get(card?.name) ?? printingFormat(card)
}

// Whether a card whose narrowest format is `cardFormat` is legal in `format`.
export const fitsFormat = (cardFormat, format) => rank(cardFormat) <= rank(format)

// The narrowest format every card fits: the widest of their own. null for none.
export function deckFormatOf(formatOf, cards) {
  let widest = null
  for (const c of cards) {
    if (!c) continue
    const f = formatOf(c)
    if (!widest || rank(f) > rank(widest)) widest = f
  }
  return widest
}
