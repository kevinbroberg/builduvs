// A tier list as a picture, for sharing. Drawn straight onto a canvas at a fixed
// width rather than screenshotted from the page, so a list built on a phone comes out
// as legible as one built on a desktop. It copies the board's look (TierMaker.vue,
// TierFace, CardAvatar) but not its layout: cards wrap at the image's width, not
// the screen's.
//
// Card art comes from the CDN, and a canvas holding another origin's pixels can't be
// saved, so art loads in CORS mode (the R2 bucket allows any origin). The board's
// <img>s load that way too, so the art here usually comes straight from cache. A card
// whose art won't load draws as a blank face rather than failing the picture.
import { getCardImage } from 'src/js/image_helper'
import { parseTierLabel } from 'src/js/tier_emoji'
import { textOn } from 'src/js/tier_colors'
import { avatarFrame, avatarColors, avatarLines, avatarFontSize, CARD_ASPECT } from 'src/js/card_avatar'

const WIDTH = 1080            // layout width in CSS px; the file is up to SCALE times this
const SCALE = 2
const MAX_PIXELS = 16e6       // iOS Safari won't draw a canvas past ~16.7M pixels
const PAD = 16                // around the whole picture
const LABEL_W = 120
const LABEL_PAD = 8
const ROW_GAP = 4
const ROW_PAD = 8             // around a row's cards
const MIN_ROW_H = 96
const GAP_X = 10
const GAP_Y = 6
const LOADS = 6               // art downloads in flight at once

// Each view mode's face: the picture's size, plus room above it for the name label.
const FACES = {
  avatar: { w: 88, h: 88, top: 22 },
  art: { w: 96, h: 96, top: 22 },
  card: { w: 112, h: Math.round(112 * CARD_ASPECT), top: 0 },
}

// The board's greys (.tm-board, and .tm-tier's tint over it).
const THEMES = {
  light: { board: '#dcdcdc', row: '#d5d5d5', text: '#1d1d1d', muted: '#6e6e6e' },
  dark: { board: '#2a2a2a', row: '#313131', text: '#f2f2f2', muted: '#9a9a9a' },
}
const BLANK = '#1c2230'       // behind art that hasn't (or won't) load

const SANS = 'Roboto, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif'
const TITLE_FONT = `600 34px ${SANS}`
const TITLE_LINE = 42
const FOOTER_FONT = `500 14px ${SANS}`
const LABEL_FONT = (px) => `700 ${px}px ${SANS}`
const NAME_FONT = (px) => `small-caps 900 ${px}px "Arial Black", "Arial Bold", Gadget, sans-serif`
const LABEL_PX = [22, 12]     // a label's font size, shrunk toward the second to fit its words

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function eachLimit(items, limit, fn) {
  let next = 0
  const worker = async () => {
    while (next < items.length) await fn(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

function shapePath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// ----- tier labels ----------------------------------------------------------------

// A label's words and :emoji: as tokens, wrapped into lines that fit `maxW`, at the
// largest font size where every word fits whole (overflow-wrap: anywhere, on the
// board, only kicks in past the smallest). Emoji grow when the label is nothing but
// emoji, as TierLabel's `jumbo` does.
function layoutLabel(ctx, label, emoji, maxW) {
  const parts = parseTierLabel(label)
  const jumbo = parts.length && parts.every(p => p.emoji || !p.text.trim())
  const tokens = parts.flatMap(p => (p.emoji
    ? [{ img: emoji.get(p.src) }]
    : p.text.split(/(\s+)/).filter(Boolean).map(text => ({ text, space: !text.trim() }))))

  const measure = (px) => {
    ctx.font = LABEL_FONT(px)
    const emojiH = px * (jumbo ? 2.4 : 1.375)
    for (const t of tokens) {
      t.w = t.img ? (emojiH * t.img.naturalWidth) / t.img.naturalHeight
        : t.img === null ? 0 : ctx.measureText(t.text).width
    }
    return emojiH
  }
  let px = LABEL_PX[0]
  let emojiH = measure(px)
  while (px > LABEL_PX[1] && tokens.some(t => t.w > maxW)) emojiH = measure(--px)

  // Still-too-long words break anywhere, a character at a time.
  const pieces = tokens.flatMap(t => {
    if (t.w <= maxW || t.img !== undefined) return [t]
    const out = []
    let text = ''
    for (const ch of t.text) {
      if (text && ctx.measureText(text + ch).width > maxW) {
        out.push({ text, w: ctx.measureText(text).width })
        text = ''
      }
      text += ch
    }
    out.push({ text, w: ctx.measureText(text).width })
    return out
  })

  const lines = []
  let line = []
  let lineW = 0
  for (const t of pieces) {
    if (t.space && !line.length) continue
    if (!t.space && line.length && lineW + t.w > maxW) {
      lines.push(line)
      line = []
      lineW = 0
    }
    line.push(t)
    lineW += t.w
  }
  if (line.length) lines.push(line)
  for (const l of lines) while (l.length && l[l.length - 1].space) l.pop()

  const lineH = (l) => Math.max(px * 1.25, l.some(t => t.img) ? emojiH + 2 : 0)
  return {
    px, emojiH, lines,
    height: lines.reduce((sum, l) => sum + lineH(l), 0),
    lineH,
  }
}

function drawLabel(ctx, layout, color, x, y, w, h) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
  ctx.font = LABEL_FONT(layout.px)
  ctx.fillStyle = textOn(color)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  let top = y + (h - layout.height) / 2
  for (const line of layout.lines) {
    const lh = layout.lineH(line)
    const mid = top + lh / 2
    let left = x + (w - line.reduce((sum, t) => sum + t.w, 0)) / 2
    for (const t of line) {
      if (t.img) ctx.drawImage(t.img, left, mid - layout.emojiH / 2, t.w, layout.emojiH)
      else if (t.text) ctx.fillText(t.text, left, mid)
      left += t.w
    }
    top += lh
  }
}

// The title's lines: word-wrapped, at most `maxLines`, the last cut short with an
// ellipsis if the rest won't fit.
function wrapTitle(ctx, text, maxW, maxLines) {
  ctx.font = TITLE_FONT
  const lines = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  let last = lines.slice(maxLines - 1).join(' ')
  while (last && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1)
  return [...lines.slice(0, maxLines - 1), `${last.trimEnd()}…`]
}

// ----- card faces -----------------------------------------------------------------

// CardAvatar's rings and crop: a dark halo, a light border, then the art inside.
function drawAvatar(ctx, card, img, x, y, size, square) {
  const { light, dark } = avatarColors(card)
  const ring = size * 0.016
  const halo = size * 0.014
  const shape = (inset) => {
    const s = size - 2 * inset
    if (square) shapePath(ctx, x + inset, y + inset, s, s, Math.max(0, size * 0.08 - inset))
    else {
      ctx.beginPath()
      ctx.arc(x + size / 2, y + size / 2, s / 2, 0, Math.PI * 2)
    }
  }
  ctx.fillStyle = dark
  shape(-halo)
  ctx.fill()
  ctx.fillStyle = light
  shape(0)
  ctx.fill()

  ctx.save()
  shape(ring)
  ctx.clip()
  ctx.fillStyle = dark
  ctx.fill()
  if (img) {
    const inner = size - 2 * ring
    const [cx, cy, r] = avatarFrame(card, square)
    const w = inner / (2 * r)
    const h = (w * img.naturalHeight) / img.naturalWidth
    ctx.drawImage(img, x + ring + inner / 2 - cx * w, y + ring + inner / 2 - cy * w * CARD_ASPECT, w, h)
  }
  ctx.restore()
}

// The outlined name across the face's top edge: tilted on a round avatar, level on a
// square one. Drawn after every face, so a neighbour's art never covers it.
function drawName(ctx, card, x, y, size, square) {
  const lines = avatarLines(card)
  const px = (avatarFontSize(lines, square) * size) / 100
  const { light, dark } = avatarColors(card)
  ctx.save()
  // The label box's bottom edge sits 20% down the face; it hangs 8% past either side
  // when tilted, and turns about its bottom-left corner.
  ctx.translate(square ? x + size / 2 : x - size * 0.08, y + size * 0.2)
  if (!square) ctx.rotate((-7 * Math.PI) / 180)
  ctx.font = NAME_FONT(px)
  ctx.textAlign = square ? 'center' : 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.lineJoin = 'round'
  lines.forEach((line, i) => {
    const ly = -(lines.length - 1 - i) * px * 0.95 - px * 0.2
    ctx.lineWidth = px * 0.44
    ctx.strokeStyle = light
    ctx.strokeText(line, 0, ly)
    ctx.lineWidth = px * 0.24
    ctx.strokeStyle = dark
    ctx.strokeText(line, 0, ly)
    ctx.fillStyle = '#fff'
    ctx.fillText(line, 0, ly)
  })
  ctx.restore()
}

function drawCard(ctx, img, x, y, w, h) {
  ctx.save()
  shapePath(ctx, x, y, w, h, w * 0.05)
  ctx.clip()
  ctx.fillStyle = BLANK
  ctx.fill()
  if (img) ctx.drawImage(img, x, y, w, h)
  ctx.restore()
}

// ----- the picture ----------------------------------------------------------------

// tiers: [{ label, color, rowColor, cards: [card] }] in board order.
// onProgress(done, total) fires as card art arrives.
export async function renderTierImage({ title, tiers, rowColor, mode, dark }, onProgress = () => {}) {
  const theme = dark ? THEMES.dark : THEMES.light
  const face = FACES[mode] ?? FACES.avatar
  const slotH = face.top + face.h
  const cardsLeft = PAD + LABEL_W
  const cardsW = WIDTH - PAD - cardsLeft
  const perLine = Math.max(1, Math.floor((cardsW - 2 * ROW_PAD + GAP_X) / (face.w + GAP_X)))

  await document.fonts?.ready
  const emoji = new Map()
  const emojiSrcs = new Set(tiers.flatMap(t => parseTierLabel(t.label).filter(p => p.emoji).map(p => p.src)))
  await Promise.all([...emojiSrcs].map(async src => emoji.set(src, await loadImage(src))))

  // Lay everything out first, so the canvas is sized once.
  const measurer = document.createElement('canvas').getContext('2d')
  const titleLines = wrapTitle(measurer, (title || '').trim(), WIDTH - 2 * PAD - 8, 2)
  let y = PAD + (titleLines.length ? titleLines.length * TITLE_LINE + 4 : 0)
  const rows = tiers.map(t => {
    const label = layoutLabel(measurer, t.label, emoji, LABEL_W - 2 * LABEL_PAD)
    const lines = Math.ceil(t.cards.length / perLine)
    const cardsH = lines ? 2 * ROW_PAD + lines * slotH + (lines - 1) * GAP_Y : 0
    const row = { tier: t, label, y, h: Math.max(MIN_ROW_H, cardsH, label.height + 2 * LABEL_PAD) }
    row.slots = t.cards.map((card, i) => ({
      card,
      x: cardsLeft + ROW_PAD + (i % perLine) * (face.w + GAP_X),
      y: y + ROW_PAD + Math.floor(i / perLine) * (slotH + GAP_Y) + face.top,
    }))
    y += row.h + ROW_GAP
    return row
  })
  const height = y - ROW_GAP + 34 + PAD

  const scale = Math.min(SCALE, Math.sqrt(MAX_PIXELS / (WIDTH * height)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(WIDTH * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  ctx.imageSmoothingQuality = 'high'

  ctx.fillStyle = theme.board
  ctx.fillRect(0, 0, WIDTH, height)
  ctx.font = TITLE_FONT
  ctx.fillStyle = theme.text
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  titleLines.forEach((line, i) => ctx.fillText(line, PAD + 4, PAD + 32 + i * TITLE_LINE))
  for (const row of rows) {
    ctx.save()
    shapePath(ctx, PAD, row.y, WIDTH - 2 * PAD, row.h, 6)
    ctx.clip()
    ctx.fillStyle = row.tier.rowColor ?? rowColor ?? theme.row
    ctx.fillRect(PAD, row.y, WIDTH - 2 * PAD, row.h)
    drawLabel(ctx, row.label, row.tier.color, PAD, row.y, LABEL_W, row.h)
    ctx.restore()
  }
  ctx.font = FOOTER_FONT
  ctx.fillStyle = theme.muted
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('builduvs.com/tiers', WIDTH - PAD - 4, height - PAD - 2)

  // Each face draws as soon as its art arrives and the art is let go, so a big list
  // never holds hundreds of full-size card images at once.
  const slots = rows.flatMap(r => r.slots)
  let done = 0
  onProgress(done, slots.length)
  await eachLimit(slots, LOADS, async ({ card, x, y: top }) => {
    const img = await loadImage(getCardImage(card.asset))
    if (mode === 'card') drawCard(ctx, img, x, top, face.w, face.h)
    else drawAvatar(ctx, card, img, x, top, face.w, mode === 'art')
    onProgress(++done, slots.length)
  })
  if (mode !== 'card') {
    for (const { card, x, y: top } of slots) drawName(ctx, card, x, top, face.w, mode === 'art')
  }
  return canvas
}

export function canvasBlob(canvas, type = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => (blob ? resolve(blob) : reject(new Error("Couldn't make the picture."))), type, quality))
}
