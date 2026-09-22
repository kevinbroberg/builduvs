#!/usr/bin/env node
/**
 * Fetch all UVS cards from the carde.io API and build a lookup map:
 *   id -> { name, slug, cardType }
 *
 * Keyed by carde.io's own card id rather than name: id is a true primary key
 * (one per printing), so this can never lose a card the way a name-keyed map
 * does when two printings share a name. See src/js/cardeio_index.js for the
 * name-based lookups built on top of this.
 *
 * Output: src/assets/cardeio-ids.json
 *
 * Usage:
 *   node scripts/fetch-cardeio-ids.mjs
 */

import https from 'node:https'
import fs from 'node:fs'

const GAME_ID = '64da688b550ba2f2010a1087'
const GAME_ID_HEADER = 'a95493de-6660-409c-abcc-8ccbcd446f2c'
const LIMIT = 200
const OUT_FILE = 'src/assets/cardeio-ids.json'

function fetchPage(page) {
  return new Promise((resolve, reject) => {
    const url = `https://play-api.carde.io/v1/cards/${GAME_ID}?limit=${LIMIT}&page=${page}`
    https.get(url, { headers: { 'game-id': GAME_ID_HEADER } }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()))
        } catch (e) {
          reject(new Error(`Parse error on page ${page}: ${e.message}`))
        }
      })
    }).on('error', reject)
  })
}

function normalizeName(name) {
  return name
    .replace(/^"+|"+$/g, '')  // strip surrounding quotes like "Loving Father"
    .trim()
    .toLowerCase()
}

async function main() {
  const first = await fetchPage(1)
  const totalPages = first.pagination.totalPages
  const totalCards = first.pagination.totalResults
  console.log(`Total cards: ${totalCards}, pages: ${totalPages}`)

  const allCards = [...first.data]

  for (let page = 2; page <= totalPages; page++) {
    process.stdout.write(`\rFetching page ${page}/${totalPages}...`)
    const result = await fetchPage(page)
    allCards.push(...result.data)
  }
  console.log(`\nFetched ${allCards.length} cards`)

  // Build lookup: id -> { name, slug, cardType }. Keyed by id, so same-named
  // reprints (still logged below, for visibility) each keep their own entry.
  const lookup = {}
  const namesSeen = new Map() // normalizedName -> count, just for the report

  for (const card of allCards) {
    const key = normalizeName(card.name)
    namesSeen.set(key, (namesSeen.get(key) ?? 0) + 1)
    lookup[card.id] = {
      name: key,
      slug: card.slug,
      cardType: card.cardType.name,
    }
  }

  const duplicateNames = [...namesSeen.entries()].filter(([, n]) => n > 1)
  if (duplicateNames.length > 0) {
    console.log(`\nNames shared by 2+ printings (${duplicateNames.length}) — all ids kept:`)
    duplicateNames.forEach(([name, n]) => console.log(`  "${name}": ${n} printings`))
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(lookup, null, 2))
  console.log(`\nWrote ${Object.keys(lookup).length} entries to ${OUT_FILE}`)
}

main().catch(err => { console.error(err); process.exit(1) })
