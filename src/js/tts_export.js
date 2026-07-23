const TTS_BACK_URL = 'https://tannerface26-dev.github.io/uvs-tts-assets/card-back-v1.png'
const UVSULTRA_BASE = 'https://uvsultra.online/images/extensions'

function randomGuid() {
  return Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('')
}

function faceUrl(card) {
  if (card.ultra_url_path) {
    // Drop `-preview` for the full-resolution image (e.g. 013-preview.jpg -> 013.jpg)
    return card.ultra_url_path
      .replace('https://www.', 'https://')
      .replace('-preview.jpg', '.jpg')
  }
  const raw = card.numero_image ?? card.numero ?? card.card_number_image ?? card.card_number
  if (raw == null || !card.extension_short) return null
  const num = String(raw).padStart(3, '0')
  return `${UVSULTRA_BASE}/${card.extension_short}/${num}.jpg`
}

function toTitleCase(str) {
  return str ? str.replace(/(?<!['‘’‚‛′])\b\w/g, c => c.toUpperCase()) : ''
}

function gmNotes(card) {
  const lines = [
    `CARD_NAME:${card.name.toLowerCase()}`,
    `TYPE:${toTitleCase(card.type)}`,
    `IMAGE_FRONT:${faceUrl(card)}`,
  ]
  return lines.join('\n')
}

function cardCustomDeckEntry(card) {
  return {
    FaceURL: faceUrl(card),
    BackURL: TTS_BACK_URL,
    NumWidth: 1,
    NumHeight: 1,
    BackIsHidden: true,
    UniqueBack: false,
    Type: 0,
  }
}

// Face-up cards use rotZ 0; face-down piles flip to rotZ 180.
function pileTransform(posX, faceDown) {
  return {
    posX,
    posY: 1.5,
    posZ: -7.9,
    rotX: 0.0,
    rotY: 180.0,
    rotZ: faceDown ? 180.0 : 0.0,
    scaleX: 1.0,
    scaleY: 1.0,
    scaleZ: 1.0,
  }
}

function makeCardObject(card, prefix, transform) {
  return {
    GUID: randomGuid(),
    Name: 'CardCustom',
    Transform: transform,
    Nickname: card.name,
    Description: '',
    GMNotes: gmNotes(card),
    AltLookAngle: { x: 0.0, y: 0.0, z: 0.0 },
    ColorDiffuse: { r: 0.713235259, g: 0.713235259, b: 0.713235259 },
    LayoutGroupSortIndex: 0,
    Value: 0,
    Locked: false,
    Grid: true,
    Snap: true,
    IgnoreFoW: false,
    MeasureMovement: false,
    DragSelectable: true,
    Autoraise: true,
    Sticky: true,
    Tooltip: true,
    GridProjection: false,
    HideWhenFaceDown: true,
    Hands: true,
    CardID: prefix * 100,
    SidewaysCard: false,
    CustomDeck: { [String(prefix)]: cardCustomDeckEntry(card) },
    LuaScript: '',
    LuaScriptState: '',
    XmlUI: '',
  }
}

function makeDeckObject(nickname, cards, getPrefix, transform) {
  const customDeck = {}
  for (const card of cards) {
    const prefix = getPrefix(card)
    customDeck[String(prefix)] = cardCustomDeckEntry(card)
  }
  return {
    GUID: randomGuid(),
    Name: 'Deck',
    Transform: transform,
    Nickname: nickname,
    Description: '',
    GMNotes: '',
    AltLookAngle: { x: 0.0, y: 0.0, z: 0.0 },
    ColorDiffuse: { r: 1.0, g: 1.0, b: 1.0 },
    LayoutGroupSortIndex: 0,
    Value: 0,
    Locked: false,
    Grid: true,
    Snap: true,
    IgnoreFoW: false,
    MeasureMovement: false,
    DragSelectable: true,
    Autoraise: true,
    Sticky: true,
    Tooltip: true,
    GridProjection: false,
    HideWhenFaceDown: true,
    Hands: false,
    SidewaysCard: false,
    DeckIDs: cards.map(card => getPrefix(card) * 100),
    CustomDeck: customDeck,
    LuaScript: '',
    LuaScriptState: '',
    XmlUI: '',
    ContainedObjects: cards.map(card => makeCardObject(card, getPrefix(card), transform)),
  }
}

// A pile with 2+ cards is a Deck; a single card is a lone card object (TTS
// decks require at least two). Returns null for an empty pile.
function makePile(nickname, cards, getPrefix, posX, faceDown) {
  const transform = pileTransform(posX, faceDown)
  if (cards.length === 0) return null
  if (cards.length === 1) return makeCardObject(cards[0], getPrefix(cards[0]), transform)
  return makeDeckObject(nickname, cards, getPrefix, transform)
}

export function generateTTSJson(deckName, faceCard, mainDeck, sideDeck = []) {
  // Flatten each zone into one card per copy, skipping cards with no resolvable image URL
  const flatten = (cards) => {
    const out = []
    for (const card of cards) {
      if (!faceUrl(card)) {
        console.error(`[tts-export] no image URL for "${card.name}" — skipping`)
        continue
      }
      for (let i = 0; i < (card.qty ?? 1); i++) out.push(card)
    }
    return out
  }

  const faceCards = faceCard && faceUrl(faceCard) ? [faceCard] : []
  const mainCards = flatten(mainDeck)
  const sideCards = flatten(sideDeck)

  // Assign a unique prefix (integer) per unique card, shared across all zones
  const prefixByKey = new Map()
  let prefixCounter = 50
  // Key on `asset` (the unique per-card id, present in every set). Older sets
  // like rampage carry no extension_short/numero, so those fields collide.
  const keyOf = (card) => card.asset ?? `${card.extension_short}/${card.numero_image ?? card.numero}`
  for (const card of [...faceCards, ...mainCards, ...sideCards]) {
    const key = keyOf(card)
    if (!prefixByKey.has(key)) prefixByKey.set(key, prefixCounter++)
  }
  const getPrefix = (card) => prefixByKey.get(keyOf(card))

  const objectStates = [
    makePile(`${deckName} — Face`, faceCards, getPrefix, 3.0, false),
    makePile(deckName, mainCards, getPrefix, -3.0, true),
    makePile(`${deckName} — Sideboard`, sideCards, getPrefix, -9.0, true),
  ].filter(Boolean)

  return {
    SaveName: '',
    Date: '',
    VersionNumber: '',
    GameMode: '',
    GameType: '',
    GameComplexity: '',
    Tags: [],
    Gravity: 0.5,
    PlayArea: 0.5,
    Table: '',
    Sky: '',
    Note: '',
    TabStates: {},
    LuaScript: '',
    LuaScriptState: '',
    XmlUI: '',
    ObjectStates: objectStates,
  }
}

export function downloadTTSJson(deckName, faceCard, mainDeck, sideDeck = []) {
  const json = generateTTSJson(deckName, faceCard, mainDeck, sideDeck)
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${deckName}.json`
  a.click()
  URL.revokeObjectURL(url)
}
