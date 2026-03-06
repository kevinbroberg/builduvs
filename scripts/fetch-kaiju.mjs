#!/usr/bin/env node
/**
 * Fetch all Godzilla: Reign of Kaiju cards from uvsultra.online
 * and output structured JSON to src/assets/kaiju.json.
 *
 * Usage:
 *   node scripts/fetch-kaiju.mjs
 */

import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'

const COOKIE = 'PHPSESSID=f4f3c1cfc4ad90961ea67782a3584996; login=bro; password=da39a3ee5e6b4b0d3255bfef95601890afd80709'
const EXTENSION_ID = '133'
const PAGES = 4 // 188 cards, 50 per page

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
        'cookie': COOKIE,
        'origin': 'https://uvsultra.online',
        'referer': 'https://uvsultra.online/index.php',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
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

  // Split on card divs
  const cardChunks = html.split(/<div class="card (?:even|odd)">/)
  // First chunk is the pagination header, skip it
  for (let i = 1; i < cardChunks.length; i++) {
    const chunk = cardChunks[i]
    const card = parseCard(chunk)
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
  const cardNumRaw = previewMatch[2]
  card.numero = parseInt(cardNumRaw, 10)
  card.numero_image = card.numero

  // Name from <h1>
  const nameMatch = chunk.match(/<h1>([^<]+)<\/h1>/)
  if (nameMatch) card.name = decodeHtmlEntities(nameMatch[1].trim())

  // Type from card-list-* class
  const typeMatch = chunk.match(/card-list-(\w+)/)
  if (typeMatch) card.type = typeMatch[1].toLowerCase()

  // Rarity - text after the type label span, before </div>
  const rarityMatch = chunk.match(/card-list-\w+">[^<]+<\/span><br \/>\s*\n?\s*(\w[\w\s]*)/)
  if (rarityMatch) card.rarity = rarityMatch[1].trim().toLowerCase()

  // Extension name from the link
  const extMatch = chunk.match(/Extension PDF for : ([^"]+)"/)
  if (extMatch) card.extension = decodeHtmlEntities(extMatch[1].trim())

  // Formats from cd1 - look for format-related lines
  card.formats = ['legacy'] // All Kaiju cards are Legacy format
  // Check for "Godzilla" sub-format
  const formatLine = chunk.match(/Godzilla - Block \d+/)
  if (formatLine) {
    card.formats.unshift('Godzilla')
  }

  // Resources from cd3 icon images (exclude attack/block zone icons)
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
    let cd2 = cd2Match[1]
    // Remove onclick wrapper
    cd2 = cd2.replace(/onclick="[^"]*"/g, '')

    // Extract keywords - they appear as <strong>Keyword</strong> at the start,
    // separated by " - " for characters, or just <strong>Keyword</strong><br/> for attacks
    const keywordsAndText = parseKeywordsAndText(cd2, card.type)
    if (keywordsAndText.keywords.length > 0) card.keywords = keywordsAndText.keywords
    card.text = keywordsAndText.text
  }

  // Parse cd3 for stats
  const cd3Match = chunk.match(/class="card_division cd3"[^>]*>([\s\S]*?)<\/div>/)
  if (cd3Match) {
    const cd3 = cd3Match[1]
    parseStats(cd3, card)
  }

  // Asset path
  const padded = String(card.numero).padStart(3, '0')
  card.asset = `${card.extension_short}/${padded}-preview.jpg`
  card.ultra_url_path = `https://www.uvsultra.online/images/extensions/${card.extension_short}/${padded}-preview.jpg`

  return card
}

function parseKeywordsAndText(cd2) {
  let keywords = []
  let text = ''

  // Try to find keyword line: consecutive <strong>Word</strong> separated by " - " or just one
  const lines = cd2.trim().split(/<br\s*\/?>\s*/m)
  let textStartIdx = 0

  // Check if the first line is a keyword line
  if (lines.length > 0) {
    const firstLine = lines[0].trim()
    // A keyword line looks like: <strong>Giant</strong> - <strong>Monster</strong>
    // or: <strong>Ranged</strong>
    // or: <strong><abbr title="..."><i>Echo</i></abbr></strong> - <strong>Tech</strong>
    const strongMatches = [...firstLine.matchAll(/<strong>(?:<abbr[^>]*><i>)?([^<]+)(?:<\/i><\/abbr>)?<\/strong>/g)]

    if (strongMatches.length > 0) {
      // Check if ALL strongs in this line are keywords (not ability types like "Enhance")
      const potentialKeywords = strongMatches.map(m => m[1].trim())
      const textRemainder = firstLine
        .replace(/<strong>(?:<abbr[^>]*><i>)?[^<]+(?:<\/i><\/abbr>)?<\/strong>/g, '')
        .replace(/\s*-\s*/g, '')
        .trim()

      // If the line is ONLY strong tags separated by " - ", it's a keyword line
      if (textRemainder === '' || textRemainder === ':') {
        keywords = potentialKeywords
        textStartIdx = 1
      } else {
        // The first strong might be an ability keyword (Enhance, Response, etc.)
        // Check if the first strong is a keyword vs ability
        const isAbility = potentialKeywords.some(k =>
          /^(Enhance|Response|Form|Blitz)/.test(k)
        )
        if (!isAbility && strongMatches.length >= 1) {
          // Could be mixed - keywords followed by text on the same line
          // This is the tricky case. Let's check the full pattern
          const kwLineMatch = firstLine.match(/^(?:<strong>(?:<abbr[^>]*><i>)?[\w\s:]+(?:<\/i><\/abbr>)?<\/strong>(?:\s*-\s*)?)+/)
          if (kwLineMatch) {
            const kwPart = kwLineMatch[0]
            const rest = firstLine.slice(kwPart.length).trim()
            if (rest === '' || rest.startsWith('<')) {
              keywords = potentialKeywords
              textStartIdx = 1
            }
          }
        }
      }
    }
  }

  // Build text from remaining lines
  const textLines = lines.slice(textStartIdx)
  text = textLines.join('\n')

  // Clean up text: remove HTML tags but preserve structure
  text = text
    .replace(/<strong>\s*/g, '')
    .replace(/<\/strong>/g, '')
    .replace(/<abbr[^>]*>/g, '')
    .replace(/<\/abbr>/g, '')
    .replace(/<i>/g, '')
    .replace(/<\/i>/g, '')
    .replace(/<a[^>]*>[^<]*<\/a>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  text = decodeHtmlEntities(text)

  // Clean up: collapse whitespace within lines
  text = text.split('\n').map(l => l.trim()).filter(l => l).join('\n\n')

  return { keywords, text }
}

function parseStats(cd3, card) {
  // Difficulty
  const diffMatch = cd3.match(/Difficulty\s*:\s*(\d+)/)
  if (diffMatch) card.difficulty = parseInt(diffMatch[1], 10)

  // Control
  const ctrlMatch = cd3.match(/Control\s*:\s*(\d+)/)
  if (ctrlMatch) card.control = parseInt(ctrlMatch[1], 10)

  // Block: +N zone
  const blockMatch = cd3.match(/Block\s*:\s*\+(\d+)\s*(?:<img[^>]*title="(\w+)")?/)
  if (blockMatch) {
    card.block_modifier = parseInt(blockMatch[1], 10)
    if (blockMatch[2]) card.block_zone = blockMatch[2].toLowerCase()
  }

  // Attack: speed zone / damage
  const attackMatch = cd3.match(/Attack\s*:\s*(\d+)\s*(?:<img[^>]*title="(\w+)"[^>]*>)?\s*\/\s*(\d+)/)
  if (attackMatch) {
    card.speed = parseInt(attackMatch[1], 10)
    if (attackMatch[2]) card.attack_zone = attackMatch[2].toLowerCase()
    card.damage = parseInt(attackMatch[3], 10)
  }

  // Hand size (characters)
  const hsMatch = cd3.match(/Hand size\s*:\s*(\d+)/)
  if (hsMatch) card.hand_size = parseInt(hsMatch[1], 10)

  // Vitality (characters)
  const vitMatch = cd3.match(/Vitality\s*:\s*(\d+)/)
  if (vitMatch) card.vitality = parseInt(vitMatch[1], 10)
}

async function main() {
  console.log('Fetching Godzilla: Reign of Kaiju card data...')
  const allCards = []

  for (let page = 0; page < PAGES; page++) {
    process.stdout.write(`  Page ${page + 1}/${PAGES}... `)
    const html = await fetchPage(page)
    const cards = parseCards(html)
    console.log(`${cards.length} cards`)
    allCards.push(...cards)
  }

  console.log(`\nTotal: ${allCards.length} cards`)

  // Sort by card number
  allCards.sort((a, b) => a.numero - b.numero)

  const outPath = path.resolve('src/assets/kaiju.json')
  fs.writeFileSync(outPath, JSON.stringify(allCards, null, 2) + '\n')
  console.log(`Written to ${outPath}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
