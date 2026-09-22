// Shared helpers over src/assets/cardeio-ids.json.
//
// The file is keyed by carde.io's own card id — a true primary key, since every
// printing has exactly one id, so reading it directly for id -> {name, slug,
// cardType} never drops data. Name is NOT unique: the catalog carries same-named
// reprints under different ids (e.g. two "Ryukyu" printings with different
// symbol pools), so anything that needs to look a card up *by name* must go
// through one of the builders below. They make the many-ids-per-name collapse
// explicit and centralized, instead of each script re-deriving a lossy
// name->id map (which is what used to silently drop ids: fetch-cardeio-ids.mjs
// keying the file BY name meant only one id per name could ever survive).
//
// Dependency-free like card_name_match.js, so both Node scripts (relative
// import) and the Vue app (`src/js/cardeio_index`) can use it.

/**
 * name (via `canon`) -> canonical display name, for Character-type cards only.
 * Used to resolve a Hydra deck's `normalized_name` field back to the cardeio
 * catalog's spelling when detecting a deck's face character.
 */
export function buildCharacterByCanonName(cardeioIds, canon) {
  const out = {}
  for (const data of Object.values(cardeioIds)) {
    if (data.cardType === 'Character') out[canon(data.name)] = data.name
  }
  return out
}

/**
 * name (via `norm`) -> { canonical, cardType }, for every card regardless of
 * type. Last-write-wins on name collisions is acceptable here (unlike the id
 * direction) because same-named reprints overwhelmingly share a cardType — the
 * property this index exists to serve.
 */
export function buildNameLookup(cardeioIds, norm) {
  const out = new Map()
  for (const data of Object.values(cardeioIds)) {
    out.set(norm(data.name), { canonical: data.name, cardType: data.cardType })
  }
  return out
}
