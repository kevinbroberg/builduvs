import { reactive } from 'vue'

const symbolImages = import.meta.globEager('/src/assets/images/*.png')

const cardImageLoaders = import.meta.glob('/src/assets/images/card_images/**/*')
const cardImageCache = reactive({})
const placeholderImage = symbolImages['/src/assets/images/set_card.png']?.default || ''

export function getSymbolImage(name) {
  return symbolImages[`/src/assets/images/${name}.png`]?.default || ''
}

export function getCardImage(asset) {
  const key = `/src/assets/images/card_images/${asset}`
  if (key in cardImageCache) return cardImageCache[key]
  const loader = cardImageLoaders[key]
  if (!loader) return ''
  cardImageCache[key] = placeholderImage
  loader().then(module => {
    cardImageCache[key] = module.default
  })
  return placeholderImage
}
