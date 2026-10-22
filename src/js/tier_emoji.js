import { getSymbolImage, getAttackZoneImage, getBlockZoneImage } from 'src/js/image_helper'
import { symbolOptions } from 'src/js/card_provider'

// Discord-style `:name:` emoji for tier labels, mapped to the game's own icons.
// Unknown names stay literal text, as they do in Discord.

const ZONES = ['high', 'mid', 'low']

export const TIER_EMOJI = Object.fromEntries([
  ...ZONES.map(z => [`attack_${z}`, getAttackZoneImage(z)]),
  ...ZONES.map(z => [`block_${z}`, getBlockZoneImage(z)]),
  ...symbolOptions.map(s => [s, getSymbolImage(s)]),
].filter(([, src]) => src))

// "S :attack_high: tier" -> [{ text: 'S ' }, { emoji: 'attack_high', src }, { text: ' tier' }]
export function parseTierLabel(label) {
  const out = []
  let last = 0
  for (const m of (label || '').matchAll(/:([a-z0-9_]+):/gi)) {
    const src = TIER_EMOJI[m[1].toLowerCase()]
    if (!src) continue
    if (m.index > last) out.push({ text: label.slice(last, m.index) })
    out.push({ emoji: m[1], src })
    last = m.index + m[0].length
  }
  if (last < (label || '').length) out.push({ text: label.slice(last) })
  return out
}
