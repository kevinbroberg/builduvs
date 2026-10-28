import { store } from "quasar/wrappers";
import { watch, toRaw, toRef } from "vue";
import { createPinia } from "pinia";

// Stores that are deliberately session-only and never written to localStorage.
// The playtest board holds a full card object per physical card (~53KB for a 65-card
// deck) and rewrites on every click; it is also a transient game state, not a document
// worth resuming. Navigate away and the board is gone, by design.
const EPHEMERAL_STORES = new Set(["playtest"]);

function persistableState(state) {
  const out = {};
  for (const [storeId, slice] of Object.entries(state)) {
    if (EPHEMERAL_STORES.has(storeId)) continue;
    out[storeId] = slice;
  }
  return out;
}

export default store((/* { ssrContext } */) => {
  const pinia = createPinia();

  // Migration (BUVS-0005): Pinia hydrates an options store from its persisted
  // slice as-is and only creates refs for keys that are present — it never
  // re-runs the state factory. A key missing from an older save (one added to
  // the store later, or an undefined one JSON.stringify dropped) then has no
  // ref: writes to it never persist, and they land on the store as a bare value
  // that storeToRefs() crashes on ("reading 'effect'" of null). So give every
  // missing key its default from the state factory, as a real state ref.
  pinia.use(({ store, options }) => {
    if (typeof options.state !== "function") return;
    for (const [key, value] of Object.entries(options.state())) {
      if (key in store.$state) continue;
      store.$state[key] = value;
      store[key] = toRef(store.$state, key);
    }
  });

  try {
    const saved = window.localStorage.getItem("builduvs_pinia");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Drop any slice left behind by an older build that did persist these.
      for (const storeId of EPHEMERAL_STORES) delete parsed[storeId];
      pinia.state.value = parsed;
    }
  } catch (e) {
    console.warn("Could not restore saved state:", e);
    window.localStorage.removeItem("builduvs_pinia");
  }

  // Cheap guard: the deep watcher also fires for ephemeral stores, so a playtest
  // click would otherwise rewrite the whole (unchanged) blob. Skip identical writes.
  let lastWritten = null;

  watch(
    pinia.state,
    (state) => {
      // Serialize undefined as null so optional state keys (e.g. the deck's `face`)
      // are never dropped from storage and their Pinia refs survive reloads.
      const json = JSON.stringify(
        persistableState(toRaw(state)),
        (_key, value) => (value === undefined ? null : value)
      );
      if (json === lastWritten) return;
      lastWritten = json;
      window.localStorage.setItem("builduvs_pinia", json);
    },
    { deep: true }
  );

  return pinia;
});
