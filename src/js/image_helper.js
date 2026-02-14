const symbolImages = import.meta.glob('/src/assets/images/*.png', { eager: true, import: 'default' })
const cardImages = import.meta.glob('/src/assets/images/card_images/*', { eager: true, import: 'default' })

export function getSymbolImage(name) {
  return symbolImages[`/src/assets/images/${name}.png`] || ''
}

export function getCardImage(asset) {
  return cardImages[`/src/assets/images/card_images/${asset}`] || ''
}
