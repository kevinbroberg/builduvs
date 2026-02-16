#!/usr/bin/env node
/**
 * Batch converts .ai files to PNG (default) or SVG using Inkscape.
 *
 * Usage:
 *   node scripts/convert-icons.mjs
 *   node scripts/convert-icons.mjs --input "AoT Creator Resources" --output src/assets/images
 *   node scripts/convert-icons.mjs --format svg   (SVG output — large for print-quality AI files)
 *   node scripts/convert-icons.mjs --width 96     (PNG width in px, default 64)
 */

import { execFileSync } from 'child_process'
import { readdirSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join, basename, extname, dirname } from 'path'
import { fileURLToPath } from 'url'
import { optimize } from 'svgo'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const INKSCAPE = 'C:\\Program Files\\Inkscape\\bin\\inkscape.exe'

const SVGO_CONFIG = {
  plugins: [
    'removeRasterImages',
    'preset-default',
  ],
}

// Parse CLI args
const args = process.argv.slice(2)
const get = (flag, fallback) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : fallback
}

const inputDir  = join(ROOT, get('--input',  'AoT Creator Resources'))
const outputDir = join(ROOT, get('--output', 'src/assets/images'))
const format    = get('--format', 'png')
const pngWidth  = get('--width', '64')

if (!existsSync(inputDir)) {
  console.error(`Input directory not found: ${inputDir}`)
  process.exit(1)
}

mkdirSync(outputDir, { recursive: true })

const files = readdirSync(inputDir).filter(f => extname(f).toLowerCase() === '.ai')

if (files.length === 0) {
  console.log('No .ai files found in', inputDir)
  process.exit(0)
}

console.log(`Converting ${files.length} files to ${format.toUpperCase()} → ${outputDir}\n`)

let ok = 0, fail = 0

for (const file of files) {
  const inputPath  = join(inputDir, file)
  const outputName = basename(file, extname(file)).toLowerCase() + '.' + format
  const outputPath = join(outputDir, outputName)

  process.stdout.write(`  ${file} → ${outputName} ... `)

  try {
    if (format === 'png') {
      execFileSync(INKSCAPE, [
        '--export-type=png',
        `--export-width=${pngWidth}`,
        `--export-filename=${outputPath}`,
        inputPath,
      ], { stdio: 'pipe' })

      const kb = Math.round(existsSync(outputPath)
        ? readFileSync(outputPath).length / 1024
        : 0)
      console.log(`ok (${kb} KB)`)

    } else {
      // SVG: export plain SVG then optimize with svgo
      const tmpPath = outputPath + '.tmp.svg'
      execFileSync(INKSCAPE, [
        '--export-type=svg',
        '--export-plain-svg',
        `--export-filename=${tmpPath}`,
        inputPath,
      ], { stdio: 'pipe' })

      const raw = readFileSync(tmpPath, 'utf8')
      const result = optimize(raw, { path: tmpPath, ...SVGO_CONFIG })
      writeFileSync(outputPath, result.data)
      execFileSync('cmd', ['/c', 'del', tmpPath], { stdio: 'pipe' })

      const kb = Math.round(result.data.length / 1024)
      console.log(`ok (${kb} KB)`)
    }

    ok++
  } catch (err) {
    console.log('FAILED')
    console.error('   ', err.stderr?.toString().trim() || err.message)
    fail++
  }
}

console.log(`\nDone: ${ok} converted, ${fail} failed`)
