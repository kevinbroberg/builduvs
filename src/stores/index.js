import { store } from "quasar/wrappers";
import { watch, toRaw } from "vue";
import { createPinia } from "pinia";

export default store((/* { ssrContext } */) => {
  const pinia = createPinia();

  try {
    const saved = window.localStorage.getItem("builduvs_pinia");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration (BUVS-0005): Pinia hydrates an options store from its persisted
      // slice as-is and only creates refs for keys that are present — it never
      // re-runs the state factory. If an earlier save dropped `face` (JSON.stringify
      // omits undefined keys), the deck store loads with no `face` ref and setting a
      // character can never persist. Backfill the key so the ref always exists.
      if (parsed.deck && !("face" in parsed.deck)) parsed.deck.face = null;
      pinia.state.value = parsed;
    }
  } catch (e) {
    console.warn("Could not restore saved state:", e);
    window.localStorage.removeItem("builduvs_pinia");
  }

  watch(
    pinia.state,
    (state) => {
      // Serialize undefined as null so optional state keys (e.g. the deck's `face`)
      // are never dropped from storage and their Pinia refs survive reloads.
      window.localStorage.setItem(
        "builduvs_pinia",
        JSON.stringify(toRaw(state), (_key, value) => (value === undefined ? null : value))
      );
    },
    { deep: true }
  );

  return pinia;
});
