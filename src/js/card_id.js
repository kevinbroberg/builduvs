// The canonical card identity for this project.
//
// ── Why this exists ──────────────────────────────────────────────────────────
// Card records live in eleven JSON files that were imported at different times
// and never agreed on how to spell a card's identity:
//
//   cards / kaiju / mha09 / provs / teamhero / tekken8  →  extension_short + numero
//   gg-critrole / sjw-mha4                              →  extension_short + card_number
//   heroesclash / rampage / rampage_dlc                 →  neither; set+number
//                                                          only exist inside `asset`
//
// Exactly one field is present, populated and well-formed on all 9,869 records:
// `asset`, the image path — "tk802/049.jpg", "mha03/001.jpg". It already encodes
// set code + collector number, it is what the CDN serves, and it is verifiable by
// eye against the printed card. So it is the identity we standardise on rather
// than inventing a new key or trusting a vendor's.
//
//   uvsId("tk802/049.jpg") === "tk802-049"
//
// Set code + collector number never change once a card is printed, which is the
// property an identifier needs and a name does not have. Names collide across
// reprints, drift between vendors ("Best Jeanist" vs "Best Jeanist (I)"), and
// differ by a single invisible codepoint — U+2019 vs U+0027 in "Jin's Glove" is
// what made that card unfindable on /lists and prompted this module.
//
// Uniqueness: 9,861 distinct ids over 9,869 records. The 8 duplicates are all in
// `4pointpromo`, a legacy UFS promo set where two cards genuinely share one image
// path. That set is not standard-legal and never appears in a decklist, so the
// collision is recorded rather than worked around; see scan below.
//
// Dependency-free on purpose: the node build scripts import this directly, so it
// must not reach for Vue, Fuse, or any asset JSON.

// "tk802/049.jpg" → { set: "tk802", number: 49, suffix: "" }
// "mha_dlc2/220.jpg" → { set: "mha_dlc2", number: 220, suffix: "" }
// A trailing letter/hyphen run after the digits (alt arts, "-preview") is kept
// as `suffix` so variant printings stay distinguishable.
const ASSET_RE = /^([A-Za-z0-9_]+)\/0*(\d+)([a-zA-Z-]*)\.(?:jpg|jpeg|png|webp)$/i

export function parseAsset(asset) {
  const m = ASSET_RE.exec(String(asset || '').trim())
  if (!m) return null
  return { set: m[1].toLowerCase(), number: Number(m[2]), suffix: (m[3] || '').toLowerCase() }
}

// Format the canonical id. Collector number is zero-padded to 3 so ids sort
// lexically in printed order, which matters for every listing that groups by set.
export function formatUvsId({ set, number, suffix = '' }) {
  return `${String(set).toLowerCase()}-${String(number).padStart(3, '0')}${suffix || ''}`
}

// "tk802-049" → { set, number, suffix }
const ID_RE = /^([a-z0-9_]+)-(\d+)([a-z-]*)$/
export function parseUvsId(id) {
  const m = ID_RE.exec(String(id || '').trim().toLowerCase())
  if (!m) return null
  return { set: m[1], number: Number(m[2]), suffix: m[3] || '' }
}

/**
 * The canonical id for one of our card records.
 *
 * Derived from `asset` first because that is the only field every file carries.
 * extension_short + numero/card_number is used as a fallback so a record with a
 * malformed or missing asset can still be identified, and so callers that hand
 * us a partial record (the crosswalk builder does) still get an answer.
 */
export function uvsId(card) {
  if (!card) return null
  const fromAsset = parseAsset(card.asset)
  if (fromAsset) return formatUvsId(fromAsset)

  const set = card.extension_short
  const number = cardNumber(card)
  if (set && number != null) return formatUvsId({ set, number })
  return null
}

// The set/collector-number pair, reading whichever spelling this record uses.
// Prefer `asset`: on the files that carry both, `asset` is the one that has
// never been observed missing or wrong.
export function cardNumber(card) {
  const fromAsset = parseAsset(card?.asset)
  if (fromAsset) return fromAsset.number
  const raw = card?.numero ?? card?.card_number
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function cardSet(card) {
  return parseAsset(card?.asset)?.set ?? (card?.extension_short ? String(card.extension_short).toLowerCase() : null)
}
