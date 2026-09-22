#!/usr/bin/env node
/**
 * Harvest card images from uvsultra.online for all JSON data files,
 * then optionally upload to Cloudflare R2.
 *
 * Usage:
 *   node scripts/harvest-images.mjs                # download all missing images
 *   node scripts/harvest-images.mjs --upload gdz01  # download then push gdz01/ to R2
 *   node scripts/harvest-images.mjs --dry-run      # just list what would be downloaded
 *   node scripts/harvest-images.mjs --concurrency 5
 *   node scripts/harvest-images.mjs --hires        # download full-res .jpg (see below)
 *
 * --hires: uvsultra serves a full-resolution image at {ext}/{num}.jpg alongside the
 * low-res {ext}/{num}-preview.jpg. In this mode we fetch the raw and save it locally
 * as {ext}/{num}.jpg. Only cards whose asset ends in `-preview.jpg` are considered —
 * cards.json/provs.json are already on a bare .jpg/.png scheme and are deliberately
 * left alone (for several of those legacy sets the "raw" is actually SMALLER than the
 * preview, so re-fetching them would be a downgrade).
 */

import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import http from 'node:http'
import { execSync } from 'node:child_process'

// ── Config ──────────────────────────────────────────────────────────
const BASE_URL = 'https://www.uvsultra.online/images/extensions'
const CARD_IMAGES_DIR = path.resolve('src/assets/images/card_images')

// R2 upload config
const R2_REMOTE = 'r2:universus'

// Some local extension namespaces don't exist on uvsultra and must be sourced from
// another extension. rampage_dlc.json is hand-authored: those cards are really mha02
// cards with high set numbers (mha02/220..231). We keep the local `mha_dlc2/` naming
// (it's the asset identity used by the deck store) but download from mha02.
const SOURCE_EXT_OVERRIDE = {
  mha_dlc2: 'mha02',
}

// Every JSON data file in the project, in load order.
const DATA_FILES = [
  'src/assets/tekken8.json',
  'src/assets/mha09.json',
  'src/assets/kaiju.json',
  'src/assets/teamhero.json',
  'src/assets/gg-critrole.json',
  'src/assets/sjw-mha4.json',
  'src/assets/heroesclash.json',
  'src/assets/rampage_dlc.json',
  'src/assets/provs.json',
  'src/assets/rampage.json',
  'src/assets/cards.json',
]

// ── CLI flags ───────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const uploadIdx = args.indexOf('--upload')
const UPLOAD = uploadIdx !== -1 ? (args[uploadIdx + 1] || '') : null
const concurrencyIdx = args.indexOf('--concurrency')
const CONCURRENCY = concurrencyIdx !== -1 ? Number(args[concurrencyIdx + 1]) : 8
const HIRES = args.includes('--hires')

// ── Helpers ─────────────────────────────────────────────────────────

/** Zero-pad the numeric prefix of a card_number_image to 3 digits.
 *  "1"   -> "001"
 *  "1B"  -> "001B"
 *  "42"  -> "042"
 *  "100" -> "100"  */
function padCardNumber(raw) {
  const match = String(raw).match(/^(\d+)(.*)$/)
  if (!match) return String(raw)
  return match[1].padStart(3, '0') + match[2]
}

/**
 * Resolve the download URL and local dest path for a card.
 *
 * Three cases:
 *  1. Card has an absolute ultra_url_path  → use it directly
 *  2. Card has a relative ultra_url_path   → prepend base URL
 *  3. No ultra_url_path                    → construct from extension_short + card number
 *
 * Local path uses the existing `asset` field when present, otherwise
 * synthesizes one from extension_short + padded card number.
 */
function resolveCard(card) {
  if (HIRES) return resolveCardHires(card)

  // ── URL ──
  let url
  if (card.ultra_url_path) {
    url = card.ultra_url_path.startsWith('http')
      ? card.ultra_url_path
      : `https://www.uvsultra.online/${card.ultra_url_path}`
  } else {
    // Derive from extension_short + card number
    const ext = card.extension_short
    const num = card.card_number_image ?? card.numero_image
    if (!ext || num == null) return null
    url = `${BASE_URL}/${ext}/${padCardNumber(num)}-preview.jpg`
  }

  // ── Local asset path ──
  let asset
  if (card.asset) {
    asset = card.asset
  } else {
    const ext = card.extension_short
    const num = card.card_number_image ?? card.numero_image
    if (!ext || num == null) return null
    asset = `${ext}/${padCardNumber(num)}-preview.jpg`
  }

  return { url, asset, dest: path.join(CARD_IMAGES_DIR, asset) }
}

/**
 * Hi-res variant: derive everything from the card's `asset`, which is the canonical
 * identity for a card (it's the deck-store key). Returns null for any card not on the
 * `-preview.jpg` scheme, which is exactly the out-of-scope set.
 */
function resolveCardHires(card) {
  let preview = card.asset
  if (!preview) {
    const ext = card.extension_short
    const num = card.card_number_image ?? card.numero_image
    if (!ext || num == null) return null
    preview = `${ext}/${padCardNumber(num)}-preview.jpg`
  }
  if (!preview.endsWith('-preview.jpg')) return null

  // `gdz01/001-preview.jpg` -> ext `gdz01`, file `001.jpg`
  const slash = preview.lastIndexOf('/')
  if (slash === -1) return null
  const localExt = preview.slice(0, slash)
  const file = preview.slice(slash + 1).replace(/-preview\.jpg$/, '.jpg')

  const sourceExt = SOURCE_EXT_OVERRIDE[localExt] || localExt
  return {
    url: `${BASE_URL}/${sourceExt}/${file}`,
    asset: `${localExt}/${file}`,
    dest: path.join(CARD_IMAGES_DIR, localExt, file),
  }
}

/**
 * Download a single file.
 *
 * Guards, because this runs unattended over thousands of files:
 *  - uvsultra answers a missing card with a 200-shaped HTML error page in some cases
 *    and a 404 HTML body in others, so we reject any non-image content-type.
 *  - reject implausibly small bodies (error pages, git-lfs pointer stubs — the existing
 *    tree has 152 of those, 130-byte pointers that got saved as .jpg).
 *  - write to a temp file and rename only on success, so a failed or partial download
 *    never leaves a corrupt file that the "already present" check would later skip.
 */
const MIN_IMAGE_BYTES = 1024

function download(url, dest) {
  return new Promise((resolve) => {
    const proto = url.startsWith('https') ? https : http
    proto.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        download(res.headers.location, dest).then(resolve)
        res.resume()
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        resolve({ ok: false, status: res.statusCode, path: dest })
        return
      }
      const ctype = String(res.headers['content-type'] || '')
      if (!ctype.startsWith('image/')) {
        res.resume()
        resolve({ ok: false, status: `not-an-image (${ctype || 'no content-type'})`, path: dest })
        return
      }

      const dir = path.dirname(dest)
      fs.mkdirSync(dir, { recursive: true })
      const tmp = `${dest}.part`
      const ws = fs.createWriteStream(tmp)
      let bytes = 0
      res.on('data', (c) => { bytes += c.length })
      res.pipe(ws)
      ws.on('finish', () => {
        if (bytes < MIN_IMAGE_BYTES) {
          fs.unlinkSync(tmp)
          resolve({ ok: false, status: `too-small (${bytes}b)`, path: dest })
          return
        }
        fs.renameSync(tmp, dest)
        resolve({ ok: true, status: 200, path: dest, bytes })
      })
      ws.on('error', (err) => {
        try { fs.unlinkSync(tmp) } catch {}
        resolve({ ok: false, status: err.message, path: dest })
      })
    }).on('error', (err) => {
      resolve({ ok: false, status: err.message, path: dest })
    })
  })
}

/** Process an array with limited concurrency. */
async function mapConcurrent(items, fn, limit) {
  const results = []
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const seen = new Set()
  const tasks = []
  let skippedNoInfo = 0

  for (const file of DATA_FILES) {
    const resolved = path.resolve(file)
    if (!fs.existsSync(resolved)) {
      console.error(`Skipping missing file: ${file}`)
      continue
    }
    const cards = JSON.parse(fs.readFileSync(resolved, 'utf-8'))
    for (const card of cards) {
      const info = resolveCard(card)
      if (!info) { skippedNoInfo++; continue }
      if (seen.has(info.asset)) continue
      seen.add(info.asset)

      // Skip if already downloaded (and not an LFS pointer stub)
      if (fs.existsSync(info.dest)) {
        const stat = fs.statSync(info.dest)
        if (stat.size > 1024) continue
      }

      tasks.push(info)
    }
  }

  console.log(`Found ${tasks.length} images to download (${seen.size} unique cards, ${seen.size - tasks.length} already present)`)
  if (skippedNoInfo) console.log(`  (${skippedNoInfo} cards skipped — missing extension_short or card number)`)

  if (tasks.length === 0 && UPLOAD === null) {
    console.log('Nothing to do.')
    return
  }

  if (DRY_RUN) {
    for (const t of tasks) {
      console.log(`  ${t.url}\n    -> ${path.relative('.', t.dest)}`)
    }
    console.log(`\nDry run complete. Re-run without --dry-run to download.`)
    return
  }

  if (tasks.length > 0) {
    // Download with concurrency limit
    let ok = 0, fail = 0
    const results = await mapConcurrent(tasks, async (t) => {
      const result = await download(t.url, t.dest)
      if (result.ok) ok++; else fail++
      process.stdout.write(`\r  Downloaded ${ok + fail}/${tasks.length} (${fail} failed)`)
      return { ...t, result }
    }, CONCURRENCY)

    console.log(`\nDone: ${ok} downloaded, ${fail} failed.`)

    const failures = results.filter(r => !r.result.ok)
    if (failures.length > 0) {
      console.log('\nFailed downloads:')
      for (const f of failures) {
        console.log(`  ${f.result.status} ${f.url}`)
      }
    }
  }

  // Upload to Cloudflare R2 via rclone
  if (UPLOAD !== null) {
    if (!UPLOAD || UPLOAD.startsWith('-')) {
      console.error('--upload requires a subfolder argument, e.g. --upload gdz01')
      process.exit(1)
    }
    const localDir = path.join(CARD_IMAGES_DIR, UPLOAD)
    if (!fs.existsSync(localDir)) {
      console.error(`Upload folder not found: ${localDir}`)
      process.exit(1)
    }
    const dest = `${R2_REMOTE}/${UPLOAD}`
    console.log(`\nUploading ${UPLOAD} to ${dest} ...`)
    try {
      execSync(
        `rclone copy "${localDir}" "${dest}" --s3-no-check-bucket --progress`,
        { stdio: 'inherit' }
      )
      console.log('Upload complete.')
    } catch (err) {
      console.error('Upload failed:', err.message)
      process.exit(1)
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
