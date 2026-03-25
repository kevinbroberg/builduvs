import { store } from "quasar/wrappers";
import { watch, toRaw } from "vue";
import { createPinia } from "pinia";

export default store((/* { ssrContext } */) => {
  const pinia = createPinia();

  try {
    const saved = window.localStorage.getItem("builduvs_pinia");
    if (saved) pinia.state.value = JSON.parse(saved);
  } catch (e) {
    console.warn("Could not restore saved state:", e);
    window.localStorage.removeItem("builduvs_pinia");
  }

  watch(
    pinia.state,
    (state) => {
      window.localStorage.setItem("builduvs_pinia", JSON.stringify(toRaw(state)));
    },
    { deep: true }
  );

  return pinia;
});
