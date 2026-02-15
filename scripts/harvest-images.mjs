#!/usr/bin/env node
/**
 * Harvest card images from uvsultra.online for all JSON data files.
 *
 * Usage:
 *   node scripts/harvest-images.mjs                # download all missing images
 *   node scripts/harvest-images.mjs --dry-run      # just list what would be downloaded
 *   node scripts/harvest-images.mjs --concurrency 5
 */

import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import http from 'node:http'

// ── Config ──────────────────────────────────────────────────────────
const BASE_URL = 'https://www.uvsultra.online/images/extensions'
const CARD_IMAGES_DIR = path.resolve('src/assets/images/card_images')

// Every JSON data file in the project, in load order.
const DATA_FILES = [
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
const concurrencyIdx = args.indexOf('--concurrency')
const CONCURRENCY = concurrencyIdx !== -1 ? Number(args[concurrencyIdx + 1]) : 8

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

/** Download a single file. Returns a promise resolving to { ok, status, path }. */
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
      const dir = path.dirname(dest)
      fs.mkdirSync(dir, { recursive: true })
      const ws = fs.createWriteStream(dest)
      res.pipe(ws)
      ws.on('finish', () => resolve({ ok: true, status: 200, path: dest }))
      ws.on('error', (err) => resolve({ ok: false, status: err.message, path: dest }))
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

  if (tasks.length === 0) {
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

main().catch(err => {
  console.error(err)
  process.exit(1)
})
