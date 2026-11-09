"""Build the Naruto custom-cards project's card data and images (/naruto).

Reads the designer's cube setlist (data/narutocubelist.xlsx) and a folder of
their card PNGs (one per card, named after it), and writes:

  src/assets/custom/naruto.json                   card records in our usual shape
  src/assets/images/card_images/nrc01/NNN.jpg     the art, ready for R2

These are fan-made custom cards, not UniVersus product. They are only ever
loaded under /naruto (src/js/custom.js); never wire this file into anything else.
The sheet's columns are this designer's own, so a new project will likely need
its own copy of this script rather than a flag on it.

  python -I scripts/gen-custom-naruto.py <folder of card PNGs>
  rclone copy src/assets/images/card_images/nrc01 r2:universus/nrc01 --s3-no-check-bucket
"""
import argparse, difflib, json, os, re
import openpyxl
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = os.path.join(ROOT, 'data/narutocubelist.xlsx')
OUT_JSON = os.path.join(ROOT, 'src/assets/custom/naruto.json')
SET = 'nrc01'
CDN = 'https://img.builduvs.com'   # src/js/image_helper.js
OUT_IMAGES = os.path.join(ROOT, 'src/assets/images/card_images', SET)
HEADER_ROW = 5         # rows above it are the designer's per-symbol tallies

RARITY = {'c': 'common', 'uc': 'uncommon', 'r': 'rare', 'ur': 'ultra rare',
          'ch': 'character', 'token': 'token'}
ZONE = {'h': 'high', 'm': 'mid', 'l': 'low'}
# The card images are newer than the sheet: some cards were renamed after it was
# last updated (same text, new title), and a few printed details never made it
# back. Keyed by the sheet's collector #; values are what the card face prints.
# Verified by eye against the images, 2026-11-09.
PRINTED = {
    8:   {'name': "Naruto's Shadow Clone", 'hand_size': 1, 'vitality': 1},
    14:  {'name': 'Seeking Vengeance'},          # sheet: Uchiha Massacre Survivor
    23:  {'name': 'Internal Monologue'},         # sheet: Inner Monologue
    32:  {'name': 'Shadow Possession'},          # sheet: Shadow Possesion
    42:  {'name': 'BLOOOOOD????!!!'},
    89:  {'name': 'Expansion Jutsu Rollout'},    # sheet: Rollout Expansion Jutsu
    99:  {'name': 'Ninja Tool Upkeep'},          # sheet: a second "Adapting Tactics"
    111: {'name': 'Endless Weapons'},            # sheet: Manriki-Gusari
    124: {'name': 'Sand Jonin Assassin'},        # sheet: Sand Jonin Assassination
    127: {'name': 'Heaven & Earth Scrolls'},
    141: {'name': 'Senbon Rainstorm'},           # sheet: Shuriken Rain
    144: {'name': "I'll Break Your Neck"},       # sheet: Neckbreaker Grapple
    158: {'name': 'Shukaku Awakens'},            # sheet: Shukaku Awakening
}
# Card name -> image file name, where the file's spelling is the odd one out
# ("Ororchimaru", "Kakashis Lighting Strike" are caught by the fuzzy match).
IMAGE_ALIASES = {}

def norm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())

def resources(raw):
    # "air/chaos/good", "inf", "Good attuned"
    out = []
    for part in str(raw).split('/'):
        p = part.strip().lower()
        if p == 'inf':
            out.append('infinity')
        elif p.endswith(' attuned'):
            out.append(p[:-len(' attuned')].strip() + '-attuned')
        else:
            out.append(p)
    return out

def split_outside_parens(s):
    parts, depth, cur = [], 0, ''
    for ch in s:
        depth += ch == '('
        depth -= ch == ')'
        if ch == ',' and depth == 0:
            parts.append(cur)
            cur = ''
        else:
            cur += ch
    return [p.strip() for p in parts + [cur] if p.strip()]

def keyword(k):
    # Capitalize words outside parentheses: "combo (low attack, high attack)"
    # -> "Combo (low attack, high attack)", "stun 1" -> "Stun 1".
    head, paren, rest = k.partition('(')
    head = ' '.join(w[:1].upper() + w[1:] for w in head.split())
    k = head + (' ' + paren + rest if paren else '')
    # Numbered keywords print as "Stun: 1" elsewhere in our data. Traits like
    # "Team 7" are names, not keyword values.
    m = re.fullmatch(r'(.+?)\s*:?\s*(\d+)', k)
    if m and not m.group(1).startswith('Team'):
        k = f'{m.group(1)}: {m.group(2)}'
    return k

def card_name(raw):
    name = ' '.join(str(raw).split())
    # A couple of rows are typed all-lowercase ("kiba inuzuka").
    return name.title() if name == name.lower() else name

def num(v):
    return None if v is None or v == '' else int(v)

def build_card(row):
    n = int(row['collector#'])
    card = {
        'extension_short': SET,
        'numero': n,
        'numero_image': n,
        'type': row['card type'].strip().lower(),
        'name': card_name(row['name']),
        'rarity': RARITY[str(row['rarity']).strip().lower()],
        'extension': 'Naruto Cube',
        'formats': ['custom'],
        'resources': resources(row['symbols']),
        'text': re.sub(r' {2,}', ' ', str(row['text'] or '')).strip(),
        'asset': f'{SET}/{n:03d}.jpg',
        # Full URL for the TTS export, which otherwise points at UVSUltra.
        'image_url': f'{CDN}/{SET}/{n:03d}.jpg',
        'cube_copies': num(row['copies']),
    }
    if row['keywords']:
        card['keywords'] = [keyword(k) for k in split_outside_parens(str(row['keywords']))]
    stats = {
        'difficulty': num(row['diff']),
        'control': num(row['check']),
        'block_modifier': num(row['block mod']),
        'block_zone': ZONE.get(str(row['block zone'] or '').strip().lower()),
        'speed': num(row['speed']),
        'attack_zone': ZONE.get(str(row['zone'] or '').strip().lower()),
        'damage': num(row['damage']),
        'hand_size': num(row['HS']),
        'vitality': num(row['HP/Vit']),
    }
    card.update({k: v for k, v in stats.items() if v is not None})
    card.update(PRINTED.get(n, {}))
    return card

def read_sheet():
    ws = openpyxl.load_workbook(SHEET, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(min_row=HEADER_ROW, values_only=True))
    header = rows[0]
    return [dict(zip(header, r)) for r in rows[1:] if r[1]]

def match_images(cards, folder):
    files = {norm(os.path.splitext(f)[0]): f for f in os.listdir(folder)
             if f.lower().endswith('.png')}
    matched, unused, missing = {}, set(files), []
    for card in cards:
        key = norm(IMAGE_ALIASES.get(card['name'], card['name']))
        if key not in files:
            # Typos in either the sheet or a file name ("Ororchimaru").
            close = difflib.get_close_matches(key, list(unused), n=1, cutoff=0.85)
            if not close:
                missing.append(f'#{card["numero"]} {card["name"]}')
                continue
            print(f'  fuzzy: #{card["numero"]} {card["name"]!r} -> {files[close[0]]!r}')
            key = close[0]
        if key not in unused:
            raise SystemExit(f'Image {files[key]!r} matched twice (#{card["numero"]} {card["name"]})')
        unused.discard(key)
        matched[card['asset']] = os.path.join(folder, files[key])
    if unused:
        print('  unused images:', sorted(files[k] for k in unused))
    if missing:
        raise SystemExit('No image for: ' + ', '.join(missing))
    return matched

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('images', help='folder of card PNGs from the designer')
    args = ap.parse_args()

    cards = [build_card(r) for r in read_sheet()]
    images = match_images(cards, args.images)

    os.makedirs(OUT_IMAGES, exist_ok=True)
    for asset, src in images.items():
        Image.open(src).convert('RGB').save(
            os.path.join(OUT_IMAGES, os.path.basename(asset)), quality=88, optimize=True)

    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(cards, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'{len(cards)} cards -> {os.path.relpath(OUT_JSON, ROOT)}, images -> {os.path.relpath(OUT_IMAGES, ROOT)}')

if __name__ == '__main__':
    main()
