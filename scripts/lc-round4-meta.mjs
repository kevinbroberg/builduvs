import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { buildCharacterByCanonName } from '../src/js/cardeio_index.js';

const cardeioIds = JSON.parse(readFileSync('src/assets/cardeio-ids.json', 'utf8'));
// Canonicalize names for matching: lowercase + strip all punctuation/whitespace runs.
// The hydra API's normalized_name drops commas/slashes/apostrophes (e.g.
// "godzilla king of the monsters"), while cardeio-ids.json names keep them
// ("godzilla, king of the monsters"), so both sides must be canonicalized to match.
const canon = s => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const characterByNormName = buildCharacterByCanonName(cardeioIds, canon);

const CF_BASE = 'https://cf-api.hydra.tabletop.gg/hydraproxy/api/v2';
// As of 2026-08-26 hydra serves these endpoints without a token. HYDRA_TOKEN is
// still honoured if present so this keeps working if auth is re-tightened.
const HYDRA_TOKEN = process.env.HYDRA_TOKEN;
const HEADERS = {
  ...(HYDRA_TOKEN ? { 'Authorization': `Token ${HYDRA_TOKEN}` } : {}),
  'Referer': 'https://play.uvsgames.com/',
  'user-agent': 'Mozilla/5.0',
};

// Season 4 / Round 4 LC template: c8723a1d-87db-4884-af68-460820cafa8b
// (Round 3 was A624f809-4a1f-4ba3-9d11-E513fc8930c0.)
//
// ⚠ When re-scanning for new events, do NOT pass display_statuses=upcoming&past —
// that silently drops events sitting at display_status "inProgress", which is not
// reachable via any documented filter value. Omit display_statuses entirely and
// filter on start_datetime client-side. 656796 and 656824 below were both invisible
// to the upcoming+past query used by scripts/scan-round3.mjs.
//
// First S4 LC weekend: 2026-08-22/23. Scanned 2026-08-26.
const EVENTS = [
  [656795, 'Alicante, ES',    '2026-08-22'], // Ateneo Cómics SLU
  [656796, 'Sheffield, GB',   '2026-08-22'], // Patriot Games Ltd  [inProgress]
  [656798, 'Greenway, AU',    '2026-08-22'], // AKIKAMBARA
  [656799, 'Gatineau, QC, CA',    '2026-08-22'], // Boutique FDB
  [656801, 'Greenfield, IN, US',  '2026-08-22'], // Hometown Comics & Games
  [656803, 'Austin, TX, US',      '2026-08-22'], // Dragon's Lair (Austin)
  [656806, 'Pittsburg, CA, US',   '2026-08-22'], // The Trade Emporium
  [656969, 'Brookfield, WI, US',  '2026-08-22'], // Game Universe Brookfield
  [829596, 'Summerville, SC, US', '2026-08-22'], // Final Round — double header Sat
  [656824, 'Metairie, LA, US',    '2026-08-23'], // Go 4 Games  [inProgress]
  [829598, 'Summerville, SC, US', '2026-08-23'], // Final Round — double header Sun
  // Weekend 2 — 2026-08-29/30. Scanned 2026-09-03, backfilled 2026-09-08 with the
  // 0-deck events (previously omitted; included for standings consistency with
  // Sheffield/Gatineau/Metairie/Glasgow above).
  // 715203 London, CA was canceled.
  [656858, 'Menomonie, WI, US',      '2026-08-26'], // Heroes Welcome Comics & Games
  [656887, 'Amsterdam, NY, US',      '2026-08-29'], // Plunder Gaming
  [656888, 'Fairfax, VA, US',        '2026-08-29'], // Gaming Giant
  [656892, 'Lowell, AR, US',         '2026-08-29'], // Chaosgames
  [656889, 'Elgin Township, IL, US', '2026-08-29'], // Boar's Hat Gaming
  [656890, 'Lubbock, TX, US',        '2026-08-29'], // Stormcrow Games
  [656896, 'Santa Clara, CA, US',    '2026-08-29'], // Game Kastle Santa Clara
  [760975, 'Blacksburg, VA, US',     '2026-08-30'], // Fun N Games Hobby Shoppe
  [656904, 'Glasgow, GB',            '2026-08-30'], // Merchants' Guild — 0 decks submitted, included for standings (like Sheffield/Gatineau/Metairie)
  // Weekend 3 — 2026-09-05/06. Scanned 2026-09-05, re-checked 2026-09-07.
  // 656804 Gamers Guild Tempe AZ (US) still 'inProgress' as of 2026-09-07 — re-scan later.
  [656967, 'Mighty Meeple, NC, US',     '2026-09-05'], // The Mighty Meeple
  [763676, 'VTC Games & More, MA, US',  '2026-09-05'], // VTC Games & More (event name says "MA")
  [656971, 'Cryptid Gaming, AR, US',    '2026-09-05'], // Cryptid Gaming LLC
  [656972, 'Exiled Games, NY, US',      '2026-09-05'], // Exiled Games
  [838612, 'counterspell games, FL, US','2026-09-05'], // counterspell games — Saturday Afternoon
  [656968, "Player's Spot, PT",     '2026-09-05'], // Player's Spot
  [656983, 'AKIKAMBARA, AU',        '2026-09-06'], // AKI LC R4 1
  [657064, 'Mundo Magic Fantasy, ES','2026-09-06'], // Local Championships Mundo Magic Fantasy
  [797541, 'The Portal, CT, US',        '2026-09-06'], // Sunday Afternoon Round 4 Local Championship
  [838614, 'counterspell games, FL, US','2026-09-06'], // counterspell games — Sunday Evening
  [701074, 'Many Realms Arena, NV, US', '2026-09-06'], // Sunday Morning Round 4 Local Championships
  // Not an official LC template — online pre-Worlds event run by Ace Maneuvers (Las Vegas),
  // treated as an LC by request. Decklists were on UVSUltra, not Hydra: 13 of 14 transcribed
  // from screenshots into decklist-overrides/lc-round4/1188804/ (#14 Jeremy M had no list).
  [1188804, 'Ace Arena, NV, US',        '2026-11-07'], // Ace Arena: World's Hype Edition (online)
];

// Hand-supplied decklists, keyed by event id + standing (same scheme as
// fetch-regional-hydra.mjs). Each file holds just the card sections; they replace the
// API deck's sections, or supply a deck when the player submitted none on Hydra.
const OVERRIDE_DIR = 'decklist-overrides/lc-round4';
const readOverride = (eventId, standing) => {
  const p = `${OVERRIDE_DIR}/${eventId}/${standing}.md`;
  return existsSync(p) ? readFileSync(p, 'utf8').replace(/^﻿/, '') : null;
};

// Resolve the SUMMARY character from an override's Character section, mirroring
// identifyCharacter(); null lets gen-locals fall back to the deck file's section.
function overrideCharacter(md) {
  const section = md.match(/^## [^\n]*Character[^\n]*\n([\s\S]*?)(?=\n## |$)/m)?.[1] ?? '';
  for (const line of section.split('\n')) {
    const name = line.match(/^\d+x\s+(.+)$/)?.[1];
    const key = canon(name);
    if (key && characterByNormName[key]) return characterByNormName[key];
  }
  return null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const get = async url => {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

const getPaged = async (url) => {
  const results = [];
  let page = 1;
  while (true) {
    const sep = url.includes('?') ? '&' : '?';
    const r = await fetch(`${url}${sep}page=${page}`, { headers: HEADERS });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    const json = await r.json();
    results.push(...(json.results ?? []));
    if (!json.next_page_number) break;
    page = json.next_page_number;
    await sleep(100);
  }
  return results;
};

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const eventFolder = (date, location) => `${date}_${slug(location)}`;

function identifyCharacter(deck) {
  const sections = deck.sections ?? [];
  // Only scan the "Starting Character" section: main decks and sideboards can legally
  // contain Character-typed cards (backup characters like "Jester Lavorre"), which
  // would otherwise mis-resolve as the deck's character. Fall back to all sections
  // only if no character-named section exists.
  const charSections = sections.filter(s => /character/i.test(s.name ?? ''));
  for (const section of (charSections.length ? charSections : sections)) {
    for (const card of section.cards ?? []) {
      for (const field of [card.card?.normalized_name, card.card?.name, card.card?.display_name]) {
        const key = canon(field);
        if (key && characterByNormName[key]) return characterByNormName[key];
      }
    }
  }
  return null;
}

async function processEvent([eventId, location, date]) {
  const event = await get(`${CF_BASE}/events/${eventId}/`);
  const playerCount = event.starting_player_count ?? event.registered_user_count ?? '?';
  process.stderr.write(`[${date}] ${location} (${playerCount} players)\n`);

  let regs;
  try {
    regs = await getPaged(`${CF_BASE}/events/${eventId}/registrations/?page_size=50`);
    await sleep(150);
  } catch (e) {
    process.stderr.write(`  ERROR fetching registrations: ${e.message}\n`);
    return { eventId, location, date, playerCount, standings: [] };
  }

  const regByUserId = {};
  for (const reg of regs) regByUserId[reg.user.id] = reg;

  const deckByUserId = {}, charByUserId = {};
  for (const reg of regs) {
    if (!reg.deck_id) continue;
    try {
      const deck = await get(`${CF_BASE}/deckbuilder/decks/${reg.deck_id}/`);
      deckByUserId[reg.user.id] = deck;
      charByUserId[reg.user.id] = identifyCharacter(deck);
      await sleep(100);
    } catch (e) {
      process.stderr.write(`  WARN: deck fetch failed user ${reg.user.id}: ${e.message}\n`);
    }
  }

  const swissRounds = [], seRounds = [];
  for (const phase of event.tournament_phases ?? []) {
    for (const round of phase.rounds ?? []) {
      if (phase.round_type === 'SWISS') swissRounds.push(round);
      else seRounds.push(round);
    }
  }

  const records = {};
  for (const userId of Object.keys(regByUserId)) {
    records[userId] = { swissRecord: [], seRecord: [] };
  }

  const fetchMatchesForRounds = async (rounds, recordKey) => {
    for (const round of rounds) {
      let matches;
      try {
        matches = await getPaged(`${CF_BASE}/tournament-rounds/${round.id}/matches/paginated/?page_size=50&avoid_cache=false`);
        await sleep(100);
      } catch (e) {
        process.stderr.write(`  WARN: matches failed round ${round.id}: ${e.message}\n`);
        continue;
      }
      const totalRounds = rounds.length;
      for (const match of matches) {
        const isBye = match.match_is_bye;
        const isDraw = !isBye && (match.match_is_intentional_draw || match.match_is_unintentional_draw);
        const winnerId = match.winning_player ?? null;

        for (const pmr of match.player_match_relationships ?? []) {
          const userId = pmr.player?.id;
          if (!userId || !records[userId]) continue;

          let outcome, gamesWon, gamesLost;
          if (isBye) {
            outcome = 'bye'; gamesWon = 0; gamesLost = 0;
          } else if (isDraw) {
            outcome = 'tie';
            gamesWon  = match.games_won_by_winner ?? 0;
            gamesLost = match.games_won_by_loser  ?? 0;
          } else {
            const isWinner = winnerId === userId;
            outcome = isWinner ? 'win' : 'loss';
            gamesWon  = isWinner ? (match.games_won_by_winner ?? 0) : (match.games_won_by_loser  ?? 0);
            gamesLost = isWinner ? (match.games_won_by_loser  ?? 0) : (match.games_won_by_winner ?? 0);
          }

          const oppPmr = (match.player_match_relationships ?? []).find(p => p.player?.id !== userId);
          const oppUserId = oppPmr?.player?.id ?? null;
          const oppReg = oppUserId ? regByUserId[oppUserId] : null;

          records[userId][recordKey].push({
            round: round.round_number,
            totalRounds,
            opponentName:      isBye ? 'BYE' : (oppReg?.best_identifier ?? 'Unknown'),
            opponentCharacter: oppUserId ? (charByUserId[oppUserId] ?? null) : null,
            opponentDeckId:    oppUserId ? (regByUserId[oppUserId]?.deck_id ?? null) : null,
            outcome, gamesWon, gamesLost,
          });
        }
      }
    }
  };

  await fetchMatchesForRounds(swissRounds, 'swissRecord');
  await fetchMatchesForRounds(seRounds, 'seRecord');

  // Placement fallback: reg.final_place_in_standings stays null until the TO
  // officially finalizes the event, so in-progress/unclosed events would otherwise
  // rank everyone 999. The tournament standings endpoint returns the true ordered
  // standings (top-cut results already factored in) — use the array order, taken
  // from the latest round that has a populated standings list.
  const placementByUserId = {};
  const rankRounds = [...swissRounds, ...seRounds].sort((a, b) => b.round_number - a.round_number);
  for (const round of rankRounds) {
    try {
      const j = await get(`${CF_BASE}/tournament-rounds/${round.id}/standings/?page_size=50`);
      const arr = j.standings ?? [];
      if (!arr.length) continue;
      arr.forEach((s, i) => { const uid = s.player?.id; if (uid != null) placementByUserId[uid] = i + 1; });
      await sleep(100);
      break;
    } catch (e) {
      process.stderr.write(`  WARN: standings failed round ${round.id}: ${e.message}\n`);
    }
  }

  const standings = regs.map(reg => ({
    standing:    reg.final_place_in_standings ?? placementByUserId[reg.user.id] ?? 999,
    player:      reg.best_identifier,
    userId:      reg.user.id,
    character:   charByUserId[reg.user.id] ?? null,
    deck:        deckByUserId[reg.user.id] ?? null,
    deckId:      reg.deck_id ?? null,
    swissRecord: records[reg.user.id]?.swissRecord ?? [],
    seRecord:    records[reg.user.id]?.seRecord    ?? [],
  }));

  return { eventId, location, date, playerCount, standings };
}

// --- Output helpers ---
const SE_LABELS = ['F', 'SF', 'QF', 'R16', 'R32', 'R64'];

// Player display names can contain a literal "|" (e.g. "BBBB | Maxwell P."), which
// would otherwise split into extra markdown table columns and make gen-locals read
// the trailing fragment as the character name. Escape it; gen-locals' splitRow()
// splits on unescaped pipes only and unescapes on the way back.
const esc = s => String(s ?? '').replace(/\|/g, '\\|');

function formatDeckFile(r, location, date, playerCount, cardSections = null) {
  const { deck, player, standing, swissRecord = [], seRecord = [] } = r;
  const lines = [];
  lines.push(`# #${standing} — ${player ?? 'Unknown'}`);
  lines.push(`**Event:** ${location} (${date}) — ${playerCount} players`);
  // An override may carry its own **Deck:** line (e.g. the UVSUltra deck title); a
  // Hydra-less override otherwise falls back to its character, like Hydra's default
  // deck names. compute-deck-symbols skips standings with no deck name.
  const overrideName = cardSections?.match(/^\*\*Deck:\*\*\s*(.+)$/m)?.[1]
    ?? cardSections?.match(/^## [^\n]*Character[^\n]*\n\d+x\s+(.+)$/m)?.[1];
  const deckName = deck?.name ?? overrideName;
  if (deckName) lines.push(`**Deck:** ${deckName}`);
  lines.push('');

  if (swissRecord.length) {
    const sorted = [...swissRecord].sort((a, b) => a.round - b.round);
    const w    = sorted.filter(m => m.outcome === 'win').length;
    const l    = sorted.filter(m => m.outcome === 'loss').length;
    const d    = sorted.filter(m => m.outcome === 'tie').length;
    const byes = sorted.filter(m => m.outcome === 'bye').length;
    const summary = byes ? `${w}-${l}-${d} +${byes} bye` : `${w}-${l}-${d}`;
    lines.push(`## Swiss (${summary})`);
    lines.push('');
    lines.push('| Rd | Opponent | Character | Deck ID | Result |');
    lines.push('|----|----------|-----------|---------|--------|');
    for (const m of sorted) {
      if (m.outcome === 'bye') {
        lines.push(`| ${m.round} | BYE | — | — | BYE |`);
      } else {
        const res = m.outcome === 'win' ? 'W' : m.outcome === 'loss' ? 'L' : 'D';
        lines.push(`| ${m.round} | ${esc(m.opponentName ?? '?')} | ${esc(m.opponentCharacter ?? '?')} | ${m.opponentDeckId ?? '—'} | ${res} ${m.gamesWon}-${m.gamesLost} |`);
      }
    }
    lines.push('');
  }

  if (seRecord.length) {
    const sorted = [...seRecord].sort((a, b) => a.round - b.round);
    const totalRounds = sorted[0]?.totalRounds ?? sorted.length;
    lines.push('## Top Cut');
    lines.push('');
    lines.push('| Round | Opponent | Character | Deck ID | Result |');
    lines.push('|-------|----------|-----------|---------|--------|');
    for (const m of sorted) {
      const label = SE_LABELS[totalRounds - m.round] ?? `Round ${m.round}`;
      const res = m.outcome === 'win' ? 'W' : m.outcome === 'loss' ? 'L' : 'D';
      lines.push(`| ${label} | ${esc(m.opponentName ?? '?')} | ${esc(m.opponentCharacter ?? '?')} | ${m.opponentDeckId ?? '—'} | ${res} ${m.gamesWon}-${m.gamesLost} |`);
    }
    lines.push('');
  }

  if (cardSections) {
    lines.push(cardSections.replace(/^\*\*Deck:\*\*.*\n+/m, '').trimEnd(), '');
    return lines.join('\n');
  }
  for (const section of deck.sections ?? []) {
    const cards = section.cards.map(c => ({
      qty:  c.quantity ?? c.count ?? 1,
      name: c.card?.display_name ?? c.card?.name ?? 'unknown',
    }));
    const total = cards.reduce((s, c) => s + c.qty, 0);
    lines.push(`## ${section.name} (${total} cards)`);
    for (const c of cards) lines.push(`${c.qty}x ${c.name}`);
    lines.push('');
  }
  return lines.join('\n');
}

function formatSummary(event) {
  const { location, date, playerCount, standings } = event;
  const lines = [];
  lines.push(`# ${location} — ${date}`);
  lines.push(`**Players:** ${playerCount}`);
  lines.push('');
  lines.push('## Standings');
  lines.push('');
  lines.push('| # | Player | Character |');
  lines.push('|---|--------|-----------|');
  const sorted = [...standings].sort((a, b) => a.standing - b.standing);
  for (const r of sorted) {
    const char = r.character ?? (r.deck || r.override ? '_unresolved_' : '_no decklist_');
    lines.push(`| ${r.standing} | ${esc(r.player ?? '?')} | ${esc(char)} |`);
  }
  lines.push('');
  return lines.join('\n');
}

// --- Main ---
(async () => {
  const OUT_DIR = 'lc-round4';
  const CACHE   = 'lc-round4-cache-v1.json';
  const cached  = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

  const allResults = [];
  for (const event of EVENTS) {
    const [eventId] = event;
    if (cached[eventId]) {
      allResults.push(cached[eventId]);
      process.stderr.write(`[cache] ${eventId}\n`);
      continue;
    }
    try {
      const result = await processEvent(event);
      cached[eventId] = result;
      allResults.push(result);
      writeFileSync(CACHE, JSON.stringify(cached, null, 2));
    } catch (e) {
      process.stderr.write(`  ERROR ${eventId}: ${e.message}\n`);
    }
    await sleep(300);
  }
  process.stderr.write(`Processed ${allResults.length} events (cache: ${CACHE})\n`);

  mkdirSync(OUT_DIR, { recursive: true });

  for (const e of allResults) {
    const dir = `${OUT_DIR}/${eventFolder(e.date, e.location)}`;
    mkdirSync(dir, { recursive: true });

    // Don't mutate the cached standings: overrides are re-read on every run.
    const standings = e.standings.map(r => {
      const override = readOverride(e.eventId, r.standing);
      if (!override) return r;
      process.stderr.write(`  [override] ${e.eventId} #${r.standing}\n`);
      return { ...r, override, character: r.deck ? r.character : overrideCharacter(override) };
    });

    const BOM = '﻿';
    writeFileSync(`${dir}/SUMMARY.md`, formatSummary({ ...e, standings }));

    const sorted = [...standings].sort((a, b) => a.standing - b.standing);
    for (const r of sorted) {
      if (!r.deck && !r.override) continue;
      const playerSlug = slug(r.player ?? 'unknown');
      const filename = `${String(r.standing).padStart(2, '0')}-${playerSlug}.md`;
      writeFileSync(`${dir}/${filename}`, BOM + formatDeckFile(r, e.location, e.date, e.playerCount, r.override));
    }

    const deckCount = sorted.filter(r => r.deck || r.override).length;
    process.stderr.write(`  ${dir}/ — ${deckCount} decklists\n`);
  }

  process.stderr.write(`\nDone! Output in ${OUT_DIR}/\n`);
})();
