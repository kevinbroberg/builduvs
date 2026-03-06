#!/usr/bin/env node
/**
 * Fetch all cards for a UVSUltra extension and output structured JSON.
 *
 * Usage:
 *   node scripts/fetch-set.mjs --id 133 --out src/assets/kaiju.json
 *   node scripts/fetch-set.mjs --id 130 --out src/assets/promo2026.json
 */

import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'

const args = process.argv.slice(2)
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null }

const EXTENSION_ID = get('--id')
const OUT_FILE = get('--out')

if (!EXTENSION_ID || !OUT_FILE) {
  console.error('Usage: node scripts/fetch-set.mjs --id <extension_id> --out <output.json>')
  process.exit(1)
}

function fetchPage(page) {
  return new Promise((resolve, reject) => {
    const body = `name=&card_text=&spotlightDD=aot&extension%5B%5D=${EXTENSION_ID}&difficulty_operand=%3D&difficulty=&keyword_text=&bm_operand=%3D&block=&as_operand=%3D&speed=&ad_operand=%3D&damage=&ac_operand=%3D&ability_count=&kc_operand=%3D&keyword_count=&v_operand=%3D&vitality=&custom_format=&page=${page}`

    const options = {
      hostname: 'uvsultra.online',
      path: '/listing_cards.php',
      method: 'POST',
      headers: {
        'accept': '*/*',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        'content-length': Buffer.byteLength(body),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&laquo;/g, '\u00AB')
    .replace(/&raquo;/g, '\u00BB')
}

function parseCards(html) {
  const cards = []
  const cardChunks = html.split(/<div class="card (?:even|odd)">/)
  for (let i = 1; i < cardChunks.length; i++) {
    const card = parseCard(cardChunks[i])
    if (card) cards.push(card)
  }
  return cards
}

function parseCard(chunk) {
  const card = {}

  // Extension short and card number from preview()
  const previewMatch = chunk.match(/preview\('(\w+)',\s*'(\w+)'\)/)
  if (!previewMatch) return null
  card.extension_short = previewMatch[1]
  card.numero = parseInt(previewMatch[2], 10)
  card.numero_image = card.numero

  // Name
  const nameMatch = chunk.match(/<h1>([^<]+)<\/h1>/)
  if (nameMatch) card.name = decodeHtmlEntities(nameMatch[1].trim())

  // Type from card-list-* class
  const typeMatch = chunk.match(/card-list-(\w+)/)
  if (typeMatch) card.type = typeMatch[1].toLowerCase()

  // Rarity
  const rarityMatch = chunk.match(/card-list-\w+">[^<]+<\/span><br \/>\s*\n?\s*(\w[\w\s]*)/)
  if (rarityMatch) card.rarity = rarityMatch[1].trim().toLowerCase()

  // Extension name
  const extMatch = chunk.match(/Extension PDF for : ([^"]+)"/)
  if (extMatch) card.extension = decodeHtmlEntities(extMatch[1].trim())

  // Formats — parse from the cd1 div
  card.formats = []
  const cd1Match = chunk.match(/class="card_division cd1"[^>]*>([\s\S]*?)<\/div>/)
  if (cd1Match) {
    const cd1 = cd1Match[1]
    // Known format patterns in cd1 text
    if (/My Hero Academia/i.test(cd1)) card.formats.push('My Hero Academia')
    if (/Godzilla/i.test(cd1)) card.formats.push('Godzilla')
    if (/Legacy/i.test(cd1)) card.formats.push('legacy')
    if (/Standard(?!\s*banned)/i.test(cd1)) card.formats.push('standard')
    if (/Retro(?!\s*banned)/i.test(cd1)) card.formats.push('retro')
  }
  if (card.formats.length === 0) card.formats.push('legacy')

  // Resources from cd3 icon images
  const cd3ForRes = chunk.match(/class="card_division cd3"[^>]*>([\s\S]*?)<\/div>/)
  if (cd3ForRes) {
    const resourceIcons = [...cd3ForRes[1].matchAll(/images\/icons\/(\w+)\.png/g)]
    card.resources = resourceIcons
      .map(m => m[1])
      .filter(r => !r.startsWith('attack') && !r.startsWith('block'))
      .map(r => r.startsWith('at_') ? r.slice(3) : r)
  } else {
    card.resources = []
  }

  // Parse cd2 for keywords and text
  const cd2Match = chunk.match(/class="card_division cd2"[^>]*>([\s\S]*?)<\/div>\s*<div class="card_division cd3"/)
  if (cd2Match) {
    let cd2 = cd2Match[1].replace(/onclick="[^"]*"/g, '')
    const keywordsAndText = parseKeywordsAndText(cd2)
    if (keywordsAndText.keywords.length > 0) card.keywords = keywordsAndText.keywords
    card.text = keywordsAndText.text
  }

  // Parse cd3 for stats
  const cd3Match = chunk.match(/class="card_division cd3"[^>]*>([\s\S]*?)<\/div>/)
  if (cd3Match) parseStats(cd3Match[1], card)

  // Asset path
  const padded = String(card.numero).padStart(3, '0')
  card.asset = `${card.extension_short}/${padded}-preview.jpg`
  card.ultra_url_path = `https://www.uvsultra.online/images/extensions/${card.extension_short}/${padded}-preview.jpg`

  return card
}

function parseKeywordsAndText(cd2) {
  let keywords = []
  const lines = cd2.trim().split(/<br\s*\/?>\s*/m)
  let textStartIdx = 0

  if (lines.length > 0) {
    const firstLine = lines[0].trim()
    const strongMatches = [...firstLine.matchAll(/<strong>(?:<abbr[^>]*><i>)?([^<]+)(?:<\/i><\/abbr>)?<\/strong>/g)]

    if (strongMatches.length > 0) {
      const potentialKeywords = strongMatches.map(m => m[1].trim())
      const textRemainder = firstLine
        .replace(/<strong>(?:<abbr[^>]*><i>)?[^<]+(?:<\/i><\/abbr>)?<\/strong>/g, '')
        .replace(/\s*-\s*/g, '')
        .trim()

      if (textRemainder === '' || textRemainder === ':') {
        keywords = potentialKeywords
        textStartIdx = 1
      } else {
        const isAbility = potentialKeywords.some(k => /^(Enhance|Response|Form|Blitz)/.test(k))
        if (!isAbility && strongMatches.length >= 1) {
          const kwLineMatch = firstLine.match(/^(?:<strong>(?:<abbr[^>]*><i>)?[\w\s:]+(?:<\/i><\/abbr>)?<\/strong>(?:\s*-\s*)?)+/)
          if (kwLineMatch) {
            const rest = firstLine.slice(kwLineMatch[0].length).trim()
            if (rest === '' || rest.startsWith('<')) {
              keywords = potentialKeywords
              textStartIdx = 1
            }
          }
        }
      }
    }
  }

  let text = lines.slice(textStartIdx).join('\n')
  text = text
    .replace(/<strong>\s*/g, '').replace(/<\/strong>/g, '')
    .replace(/<abbr[^>]*>/g, '').replace(/<\/abbr>/g, '')
    .replace(/<i>/g, '').replace(/<\/i>/g, '')
    .replace(/<a[^>]*>[^<]*<\/a>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  text = decodeHtmlEntities(text)
  text = text.split('\n').map(l => l.trim()).filter(l => l).join('\n\n')

  return { keywords, text }
}

function parseStats(cd3, card) {
  const diffMatch = cd3.match(/Difficulty\s*:\s*(\d+)/)
  if (diffMatch) card.difficulty = parseInt(diffMatch[1], 10)

  const ctrlMatch = cd3.match(/Control\s*:\s*(\d+)/)
  if (ctrlMatch) card.control = parseInt(ctrlMatch[1], 10)

  const blockMatch = cd3.match(/Block\s*:\s*\+(\d+)\s*(?:<img[^>]*title="(\w+)")?/)
  if (blockMatch) {
    card.block_modifier = parseInt(blockMatch[1], 10)
    if (blockMatch[2]) card.block_zone = blockMatch[2].toLowerCase()
  }

  const attackMatch = cd3.match(/Attack\s*:\s*(\d+)\s*(?:<img[^>]*title="(\w+)"[^>]*>)?\s*\/\s*(\d+)/)
  if (attackMatch) {
    card.speed = parseInt(attackMatch[1], 10)
    if (attackMatch[2]) card.attack_zone = attackMatch[2].toLowerCase()
    card.damage = parseInt(attackMatch[3], 10)
  }

  const hsMatch = cd3.match(/Hand size\s*:\s*(\d+)/)
  if (hsMatch) card.hand_size = parseInt(hsMatch[1], 10)

  const vitMatch = cd3.match(/Vitality\s*:\s*(\d+)/)
  if (vitMatch) card.vitality = parseInt(vitMatch[1], 10)
}

async function main() {
  // Fetch page 0 to get total count
  process.stdout.write('Fetching page 1... ')
  const firstHtml = await fetchPage(0)
  const totalMatch = firstHtml.match(/(\d+) Results/)
  const total = totalMatch ? parseInt(totalMatch[1], 10) : 0
  const pages = Math.ceil(total / 50)
  const allCards = parseCards(firstHtml)
  console.log(`${allCards.length} cards (${total} total across ${pages} page${pages > 1 ? 's' : ''})`)

  for (let page = 1; page < pages; page++) {
    process.stdout.write(`Fetching page ${page + 1}... `)
    const html = await fetchPage(page)
    const cards = parseCards(html)
    console.log(`${cards.length} cards`)
    allCards.push(...cards)
  }

  console.log(`\nTotal: ${allCards.length} cards`)
  allCards.sort((a, b) => a.numero - b.numero)

  const outPath = path.resolve(OUT_FILE)
  fs.writeFileSync(outPath, JSON.stringify(allCards, null, 2) + '\n')
  console.log(`Written to ${outPath}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
