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

### Customize the configuration
See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).

### Rebuild the public tournament dataset
After `scripts/gen-locals.mjs` or `scripts/gen-majors.mjs`, run
```bash
yarn dataset
```
This flattens the published decklist data into CSVs under `public/data/` (served at
`/data/`, explained to visitors at `/ask`) so anyone can analyse it with their own
AI assistant, DuckDB or pandas. It also writes `data/builduvs.sqlite` for local use (not committed).
