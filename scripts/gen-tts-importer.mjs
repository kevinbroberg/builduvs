/**
 * Packs tts/importer.lua into a Tabletop Simulator saved object at
 * public/tts/builduvs-importer.json, served at
 * https://builduvs.com/tts/builduvs-importer.json.
 *
 * Players drop that file into
 *   Documents/My Games/Tabletop Simulator/Saves/Saved Objects/
 * and spawn it from Objects → Saved Objects. Re-run after editing the Lua:
 *
 *   node scripts/gen-tts-importer.mjs
 *
 * It also draws the tile's face, public/tts/importer-backdrop.png: a dark
 * panel with a header band, a well behind the list rows and a footer for the
 * nav buttons. The script's buttons sit on top, so the bands are placed from
 * the layout numbers in importer.lua, read from the Lua itself. TTS caches
 * images by URL: if the backdrop changes after release, bump BACKDROP_VERSION
 * so players' copies fetch the new one. Requires the @napi-rs/canvas dev
 * dependency.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lua = fs.readFileSync(path.join(root, 'tts', 'importer.lua'), 'utf8')

// ── Backdrop ─────────────────────────────────────────────────────────────────

const BACKDROP_VERSION = 1
const BACKDROP_FILE = 'importer-backdrop.png'

const layout = (name) => {
  const m = lua.match(new RegExp(`^local ${name} = (-?[0-9.]+)`, 'm'))
  if (!m) throw new Error(`importer.lua has no number named ${name}`)
  return Number(m[1])
}
const ROWS = layout('ROWS'), TOP = layout('TOP'), ROW_STEP = layout('ROW_STEP')
const ROW_H = layout('ROW_H'), HEADER_Z = layout('HEADER_Z'), NAV_Z = layout('NAV_Z')

const FONT_DIR = process.env.FONT_DIR || 'C:/Windows/Fonts'
const fontFile = path.join(FONT_DIR, 'seguisb.ttf')
if (fs.existsSync(fontFile)) GlobalFonts.registerFromPath(fontFile, 'Semi')
else console.warn(`[font] missing ${fontFile}; the backdrop's lettering will fall back`)

async function drawBackdrop() {
  const S = 1024
  const px = (u) => ((u + 1) / 2) * S // tile-local -1..1 → pixels
  const canvas = createCanvas(S, S)
  const ctx = canvas.getContext('2d')
  const box = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r) }

  const bg = ctx.createLinearGradient(0, 0, 0, S)
  bg.addColorStop(0, '#171c2a')
  bg.addColorStop(1, '#0d1018')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, S, S)
  const glow = ctx.createRadialGradient(S / 2, 0, 0, S / 2, 0, S * 0.6)
  glow.addColorStop(0, 'rgba(255,120,40,0.10)')
  glow.addColorStop(1, 'rgba(255,120,40,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, S, S)

  box(8, 8, S - 16, S - 16, 18)
  ctx.strokeStyle = '#2a3246'
  ctx.lineWidth = 2
  ctx.stroke()

  // Kicker above the header: the logo and the importer's name.
  const logo = await loadImage(path.join(root, 'public', 'icons', 'icon-128x128.png'))
  const kickY = px(HEADER_Z - ROW_H / 2) / 2 + 4
  ctx.font = '600 17px Semi'
  const kicker = 'B U I L D U V S    ·    D E C K   I M P O R T E R'
  const kw = ctx.measureText(kicker).width
  const logoS = 22
  const kx = (S - kw - logoS - 10) / 2
  ctx.drawImage(logo, kx, kickY - logoS / 2, logoS, logoS)
  ctx.fillStyle = '#8691ad'
  ctx.textBaseline = 'middle'
  ctx.fillText(kicker, kx + logoS + 10, kickY + 1)

  // Header band the title is written on, underlined in the logo's colors.
  const hTop = px(HEADER_Z - ROW_H / 2), hBot = px(HEADER_Z + ROW_H / 2)
  box(px(-0.95), hTop, px(0.95) - px(-0.95), hBot - hTop, 12)
  ctx.fillStyle = 'rgba(255,255,255,0.045)'
  ctx.fill()
  const line = ctx.createLinearGradient(px(-0.6), 0, px(0.6), 0)
  line.addColorStop(0, 'rgba(255,160,0,0)')
  line.addColorStop(0.3, '#ffa000')
  line.addColorStop(0.7, '#f4511e')
  line.addColorStop(1, 'rgba(244,81,30,0)')
  ctx.fillStyle = line
  ctx.fillRect(px(-0.6), hBot + 7, px(0.6) - px(-0.6), 3)

  // The well the rows sit in; the gaps between rows show it as dividers.
  const wTop = px(TOP - ROW_H / 2) - 10
  const wBot = px(TOP + (ROWS - 1) * ROW_STEP + ROW_H / 2) + 10
  box(px(-0.95), wTop, px(0.95) - px(-0.95), wBot - wTop, 14)
  ctx.fillStyle = '#0a0d14'
  ctx.fill()
  ctx.strokeStyle = '#232a3b'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Footer: a rule above the nav buttons and the site's address below them.
  ctx.fillStyle = '#232a3b'
  ctx.fillRect(px(-0.9), px(NAV_Z - ROW_H / 2) - 12, px(0.9) - px(-0.9), 1.5)
  ctx.font = '600 15px Semi'
  ctx.fillStyle = '#5d6782'
  ctx.textAlign = 'center'
  ctx.fillText('builduvs.com', S / 2, (px(NAV_Z + ROW_H / 2) + S) / 2)

  const out = path.join(root, 'public', 'tts', BACKDROP_FILE)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, canvas.toBuffer('image/png'))
  console.log(`Wrote ${path.relative(root, out)}`)
}

await drawBackdrop()

// ── Saved object ─────────────────────────────────────────────────────────────

const importer = {
  GUID: 'b0e1d5',
  Name: 'Custom_Tile',
  Transform: {
    posX: 0, posY: 1, posZ: 0,
    rotX: 0, rotY: 180, rotZ: 0,
    scaleX: 3.5, scaleY: 1, scaleZ: 3.5,
  },
  Nickname: 'BuildUVS Deck Importer',
  Description: 'Browse builduvs.com decklists and click a deck to spawn it, or paste a deck link.',
  GMNotes: '',
  ColorDiffuse: { r: 1, g: 1, b: 1 },
  Locked: false,
  Grid: true,
  Snap: true,
  IgnoreFoW: false,
  Autoraise: true,
  Sticky: true,
  Tooltip: true,
  Hands: false,
  CustomImage: {
    ImageURL: `https://builduvs.com/tts/${BACKDROP_FILE}?v=${BACKDROP_VERSION}`,
    ImageSecondaryURL: '',
    ImageScalar: 1,
    WidthScale: 0,
    CustomTile: { Type: 0, Thickness: 0.2, Stackable: false, Stretch: true },
  },
  LuaScript: lua,
  LuaScriptState: '',
  XmlUI: '',
}

// A saved object is a save file holding one object.
const saved = {
  SaveName: 'BuildUVS Deck Importer',
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
  ObjectStates: [importer],
}

const outFile = path.join(root, 'public', 'tts', 'builduvs-importer.json')
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(saved, null, 2) + '\n')
console.log(`Wrote ${path.relative(root, outFile)}`)
