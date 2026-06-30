const TTS_BACK_URL = 'https://tannerface26-dev.github.io/uvs-tts-assets/card-back-v1.png'
const UVSULTRA_BASE = 'https://uvsultra.online/images/extensions'

function randomGuid() {
  return Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('')
}

function faceUrl(card) {
  if (card.ultra_url_path) {
    return card.ultra_url_path.replace('https://www.', 'https://')
  }
  const raw = card.numero_image ?? card.numero ?? card.card_number_image ?? card.card_number
  if (raw == null || !card.extension_short) return null
  const num = String(raw).padStart(3, '0')
  return `${UVSULTRA_BASE}/${card.extension_short}/${num}.jpg`
}

function toTitleCase(str) {
  return str ? str.replace(/\b\w/g, c => c.toUpperCase()) : ''
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

export function generateTTSJson(deckName, faceCard, mainDeck) {
  // Flatten deck into one card per copy, skipping cards with no resolvable image URL
  const allCards = []
  const addCard = (card) => {
    if (!faceUrl(card)) {
      console.error(`[tts-export] no image URL for "${card.name}" — skipping`)
      return false
    }
    return true
  }
  if (faceCard && addCard(faceCard)) allCards.push({ ...faceCard, qty: 1 })
  for (const card of mainDeck) {
    if (!addCard(card)) continue
    for (let i = 0; i < (card.qty ?? 1); i++) {
      allCards.push(card)
    }
  }

  // Assign a unique prefix (integer) per unique card (by extension_short + numero_image/numero)
  const prefixByKey = new Map()
  let prefixCounter = 50
  for (const card of allCards) {
    const key = `${card.extension_short}/${card.numero_image ?? card.numero}`
    if (!prefixByKey.has(key)) prefixByKey.set(key, prefixCounter++)
  }

  const getPrefix = (card) =>
    prefixByKey.get(`${card.extension_short}/${card.numero_image ?? card.numero}`)

  const deckIds = allCards.map(card => getPrefix(card) * 100)

  const customDeck = {}
  for (const [key, prefix] of prefixByKey) {
    const card = allCards.find(
      c => `${c.extension_short}/${c.numero_image ?? c.numero}` === key
    )
    customDeck[String(prefix)] = cardCustomDeckEntry(card)
  }

  const containedObjects = allCards.map(card => {
    const prefix = getPrefix(card)
    return {
      GUID: randomGuid(),
      Name: 'CardCustom',
      Transform: {
        posX: 9.954949,
        posY: 1.5,
        posZ: -7.93913555,
        rotX: 0.0,
        rotY: 180.0,
        rotZ: 180.0,
        scaleX: 1.0,
        scaleY: 1.0,
        scaleZ: 1.0,
      },
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
  })

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
    ObjectStates: [
      {
        GUID: randomGuid(),
        Name: 'Deck',
        Transform: {
          posX: 9.950107,
          posY: 1.29384339,
          posZ: -7.93893147,
          rotX: 0.0,
          rotY: 180.032471,
          rotZ: 180.0,
          scaleX: 1.0,
          scaleY: 1.0,
          scaleZ: 1.0,
        },
        Nickname: deckName,
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
        DeckIDs: deckIds,
        CustomDeck: customDeck,
        LuaScript: '',
        LuaScriptState: '',
        XmlUI: '',
        ContainedObjects: containedObjects,
      },
    ],
  }
}

export function downloadTTSJson(deckName, faceCard, mainDeck) {
  const json = generateTTSJson(deckName, faceCard, mainDeck)
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${deckName}.json`
  a.click()
  URL.revokeObjectURL(url)
}
