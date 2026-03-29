#!/usr/bin/env node
/**
 * Fetch all Team Hero + Team Rival cards from uvsultra.online
 * and output structured JSON to src/assets/teamhero.json.
 *
 * Usage:
 *   node scripts/fetch-teamhero.mjs
 */

import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'

const EXTENSION_ID = '131'
const PAGES = 3 // estimate ~100-150 cards, will fetch until empty

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

  const previewMatch = chunk.match(/preview\('(\w+)',\s*'(\w+)'\)/)
  if (!previewMatch) return null
  card.extension_short = previewMatch[1]
  card.numero = parseInt(previewMatch[2], 10)
  card.numero_image = card.numero

  const nameMatch = chunk.match(/<h1>([^<]+)<\/h1>/)
  if (nameMatch) card.name = decodeHtmlEntities(nameMatch[1].trim())

  const typeMatch = chunk.match(/card-list-(\w+)/)
  if (typeMatch) card.type = typeMatch[1].toLowerCase()

  const rarityMatch = chunk.match(/card-list-\w+">[^<]+<\/span><br \/>\s*\n?\s*(\w[\w\s]*)/)
  if (rarityMatch) card.rarity = rarityMatch[1].trim().toLowerCase()

  const extMatch = chunk.match(/Extension PDF for : ([^"]+)"/)
  if (extMatch) card.extension = decodeHtmlEntities(extMatch[1].trim())

  card.formats = ['standard', 'legacy']

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

  const cd2Match = chunk.match(/class="card_division cd2"[^>]*>([\s\S]*?)<\/div>\s*<div class="card_division cd3"/)
  if (cd2Match) {
    const { keywords, text } = parseKeywordsAndText(cd2Match[1])
    if (keywords.length > 0) card.keywords = keywords
    card.text = text
  }

  const cd3Match = chunk.match(/class="card_division cd3"[^>]*>([\s\S]*?)<\/div>/)
  if (cd3Match) parseStats(cd3Match[1], card)

  const padded = String(card.numero).padStart(3, '0')
  card.asset = `${card.extension_short}/${padded}-preview.jpg`
  card.ultra_url_path = `https://www.uvsultra.online/images/extensions/${card.extension_short}/${padded}-preview.jpg`

  return card
}

function parseKeywordsAndText(cd2) {
  let keywords = []
  let text = ''

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
        if (!isAbility) {
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

  text = lines.slice(textStartIdx).join('\n')
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
  console.log('Fetching Team Hero + Team Rival card data...')
  const allCards = []

  for (let page = 0; page < PAGES; page++) {
    process.stdout.write(`  Page ${page + 1}/${PAGES}... `)
    const html = await fetchPage(page)
    const cards = parseCards(html)
    console.log(`${cards.length} cards`)
    if (cards.length === 0) break
    allCards.push(...cards)
  }

  console.log(`\nTotal: ${allCards.length} cards`)
  allCards.sort((a, b) => a.numero - b.numero)

  const outPath = path.resolve('src/assets/teamhero.json')
  fs.writeFileSync(outPath, JSON.stringify(allCards, null, 2) + '\n')
  console.log(`Written to ${outPath}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
