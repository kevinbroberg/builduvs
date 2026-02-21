const symbolImages = import.meta.globEager('/src/assets/images/*.png')

const CDN_BASE = 'https://pub-aa47ca6c03d2428a9e22ac6b5d839945.r2.dev/card_images'
const placeholderImage = symbolImages['/src/assets/images/set_card.png']?.default || ''

export function getSymbolImage(name) {
  return symbolImages[`/src/assets/images/uvs-icon-${name}.png`]?.default || ''
}

export function getAttackZoneImage(name) {
  return symbolImages[`/src/assets/images/aot-icon-attack-${name}-rules.png`]?.default || ''
}

export function getBlockZoneImage(name) {
  return symbolImages[`/src/assets/images/aot-icon-block-${name}-.png`]?.default || ''
}

export function getCardImage(asset) {
  if (!asset) return placeholderImage
  return `${CDN_BASE}/${asset}`
}
