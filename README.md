# BuildUVS (builduvs)

A companion for playing My Hero Academia CCG and Universus

## Install the dependencies
```bash
yarn
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)
```bash
yarn dev
```


### Lint the files
```bash
yarn lint
```


### Format the files
```bash
yarn format
```



### Build the app for production
```bash
quasar build
```

### Tabletop Simulator

Every decklist is also served as TTS JSON at `/lists/:event/:id/tts.json` and
`/majors/:event/:id/tts.json` (`netlify/edge-functions/deck-tts.js`). Regenerate
its data after the decklists or card data change:
```bash
node scripts/gen-tts-manifest.mjs
```

The same function serves listings for browsing: `/lists/tts.json` and
`/majors/tts.json` (events grouped by format or season) and
`/lists/:event/tts.json` / `/majors/:event/tts.json` (an event's decks).

The **BuildUVS Deck Importer** is a TTS object that uses them in-game.
Share https://builduvs.com/tts/builduvs-importer.json — players save it to
`Documents/My Games/Tabletop Simulator/Saves/Saved Objects/`, spawn it from
Objects → Saved Objects, then browse to a deck and click it (or paste a deck
link). Its script lives
in `tts/importer.lua`; after editing it, rebuild the object:
```bash
node scripts/gen-tts-importer.mjs
```

### Customize the configuration
See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).
