// Colors for the tier maker: label swatches, row-background swatches, and the
// black-or-white text choice that keeps a label readable on whatever it's given.

export const LABEL_PALETTE = ['#4caf50', '#8bc34a', '#ffeb3b', '#f0932b', '#e53935', '#7a5c45',
  '#ff7f7f', '#ffbf7f', '#ffdf7f', '#ffff7f', '#bfff7f', '#7fff7f',
  '#9c27b0', '#3f51b5', '#03a9f4', '#009688', '#78909c', '#212121']

// Darks first: cards read best on them.
export const ROW_PALETTE = ['#1a1a17', '#263238', '#37474f', '#4e342e', '#1b2a49', '#2e1f3e',
  '#616161', '#bdbdbd', '#eeeeee', '#ffffff', '#fff3e0', '#e8f5e9', '#e3f2fd', '#fce4ec']

// Black or white text, whichever reads better on `hex`.
export function textOn(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex || '')
  if (!m) return '#fff'
  const [r, g, b] = m.slice(1).map(h => parseInt(h, 16) / 255)
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? '#111' : '#fff'
}
