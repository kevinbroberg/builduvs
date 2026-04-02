#!/usr/bin/env node
/**
 * Scrapes Universus Rewards Store update pages from uvsgames.com and outputs
 * the data needed for src/assets/store-rotations.json.
 *
 * Usage:
 *   node scripts/scrape-store-rotations.js
 *   node scripts/scrape-store-rotations.js --out src/assets/store-rotations.json
 *
 * Requires Node 18+ (native fetch). No extra dependencies needed.
 */

import { writeFileSync } from "fs";

const OUT_FLAG = process.argv.indexOf("--out");
const OUT_FILE = OUT_FLAG !== -1 ? process.argv[OUT_FLAG + 1] : null;

// Build every Monday date from 2025-08-04 through today, formatted MM-DD-YY
function mondays(from, to) {
  const dates = [];
  const d = new Date(from);
  // Advance to first Monday
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  while (d <= to) {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(2);
    dates.push({ slug: `${mm}-${dd}-${yy}`, iso: d.toISOString().slice(0, 10) });
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

const DATES = mondays(new Date("2025-08-04"), new Date());

async function fetchPage(slug) {
  const url = `https://uvsgames.com/news/${slug}-rewards-store-update/`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; builduvs-scraper/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Extract item names from a Rewards Store update page.
 * The site lists items in <li> or <p> tags inside the post body.
 * This parser strips HTML tags and returns non-empty lines that look like item names.
 */
function parseItems(html) {
  // Grab the post content area (between entry-content / post-content divs)
  const contentMatch =
    html.match(/<div[^>]*class="[^"]*(?:entry-content|post-content|article-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);

  const body = contentMatch ? contentMatch[1] : html;

  // Extract <li> text nodes first
  const liItems = [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);

  if (liItems.length > 0) return liItems;

  // Fallback: extract <p> text nodes
  return [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
    .filter((s) => s.length > 2 && s.length < 120 && !s.includes("<"));
}

async function main() {
  const rotations = [];
  const allItemNames = new Set();

  console.error(`Checking ${DATES.length} potential URLs...`);

  for (const { slug, iso } of DATES) {
    process.stderr.write(`  ${iso} ... `);
    const html = await fetchPage(slug);
    if (!html) {
      process.stderr.write("not found\n");
      continue;
    }
    const items = parseItems(html);
    process.stderr.write(`found (${items.length} items)\n`);
    items.forEach((i) => allItemNames.add(i));
    if (items.length > 0) {
      rotations.push({ week: iso, items });
    }
  }

  // Sort rotations newest-first
  rotations.sort((a, b) => b.week.localeCompare(a.week));

  // Build the items master list with auto-generated IDs
  const itemsList = [...allItemNames].sort().map((name) => ({
    id: name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    name,
    category: "",  // fill in manually if desired
  }));

  // Replace item names in rotations with IDs
  const nameToId = Object.fromEntries(itemsList.map((i) => [i.name, i.id]));
  const rotationsWithIds = rotations.map((r) => ({
    week: r.week,
    items: r.items.map((name) => nameToId[name] ?? name),
  }));

  const output = {
    items: itemsList,
    rotations: rotationsWithIds,
  };

  const json = JSON.stringify(output, null, 2);

  if (OUT_FILE) {
    writeFileSync(OUT_FILE, json, "utf8");
    console.error(`\nWrote ${OUT_FILE}`);
  } else {
    console.log(json);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
