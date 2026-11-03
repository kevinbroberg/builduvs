// The geometry behind CardAvatar.vue, shared with the tier list image export
// (src/js/tier_image.js) so both crop and label a card the same way.
import avatars from 'assets/avatars.json'

export const CARD_ASPECT = 1039 / 744         // card image height / width
const FALLBACK = [0.5, 0.256, 0.357, null]    // matches .standing-avatar's scale(1.4) top crop

// How much more of the art a square shows around a detected face, and the bounds
// on its half-width (in card widths): enough to read as art, never the frame.
const SQUARE_ZOOM = 2.4
const SQUARE_HALF = [0.3, 0.45]
// Roughly where the art gives way to the name bar and text box, as a fraction of
// the card's height. A square stops above it, sliding up (or shrinking) to fit.
const ART_BOTTOM = 0.55

// The face crop scripts/detect-avatars.py found for a card, else a top-of-art crop.
// [cx, cy, r, hue]
export const avatarCrop = (card) => avatars[card.asset] ?? FALLBACK

// [cx, cy, r]: centre as fractions of the card's width/height, r (half the visible
// width) as a fraction of its width.
export function avatarFrame(card, square) {
  const [cx, cy, r] = avatarCrop(card)
  if (!square || !avatars[card.asset]) return [cx, cy, r]
  const artBottom = ART_BOTTOM * CARD_ASPECT  // in card widths, like `half`
  const half = Math.min(SQUARE_HALF[1], Math.max(SQUARE_HALF[0], r * SQUARE_ZOOM), artBottom / 2)
  // Slide the wider square back inside the art rather than show past its edge.
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
  const x = clamp(cx, half, 1 - half)
  const y = clamp(cy * CARD_ASPECT, half, artBottom - half) / CARD_ASPECT
  return [x, y, half]
}

// The ring colors, tinted from the art when the crop carries a hue.
export function avatarColors(card) {
  const hue = avatarCrop(card)[3]
  return hue == null
    ? { light: '#d6dbe4', dark: '#1c2230' }
    : { light: `hsl(${hue} 100% 72%)`, dark: `hsl(${hue} 67% 13%)` }
}

// "Erwin Smith, Strategic Mastermind" -> ["Erwin", "Smith"]: the title won't fit, and
// past 10 characters a name breaks onto two lines, at the space nearest its middle:
// a long single line shrinks to illegible.
export function avatarLines(card) {
  const text = card.name.split(',')[0]
  if (text.length <= 10 || !text.includes(' ')) return [text]
  const mid = text.length / 2
  let at = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ' && (at < 0 || Math.abs(i - mid) < Math.abs(at - mid))) at = i
  }
  return [text.slice(0, at), text.slice(at + 1)]
}

// The label's font size, as a percentage of the avatar's width, so its longest line
// fits. The square's level banner spans the tile's width; the slanted label hangs
// past it (116%), so has more room.
export function avatarFontSize(lines, square) {
  const longest = Math.max(...lines.map(l => l.length))
  const room = square ? 100 / 116 : 1
  return Math.min(15, (100 * room) / (longest * 0.68))
}
