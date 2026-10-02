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
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lua = fs.readFileSync(path.join(root, 'tts', 'importer.lua'), 'utf8')

const importer = {
  GUID: 'b0e1d5',
  Name: 'Custom_Tile',
  Transform: {
    posX: 0, posY: 1, posZ: 0,
    rotX: 0, rotY: 180, rotZ: 0,
    scaleX: 2.5, scaleY: 1, scaleZ: 2.5,
  },
  Nickname: 'BuildUVS Deck Importer',
  Description: 'Paste a builduvs.com deck link into the box and press Import.',
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
    ImageURL: 'https://builduvs.com/icons/icon-512x512.png',
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
