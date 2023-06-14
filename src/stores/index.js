import { store } from "quasar/wrappers";
import { watch } from "vue";
import { createPinia } from "pinia";
import { LocalStorage } from "quasar";

/*
 * If not building with SSR mode, you can
 * directly export the Store instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Store instance.
 */

export default store((/* { ssrContext } */) => {
  const pinia = createPinia();

  // You can add Pinia plugins here
  // pinia.use(SomePiniaPlugin)

  let previous_state = LocalStorage.getItem("health_state");

  if (previous_state) {
    console.log(
      `Loaded old state with current p1 hp ${previous_state?.player1?.health}`
    );
    // TODO probably a big security hole
    pinia.state.value = JSON.parse(previous_state);
  } else {
    console.log("no previous state");
  }

  watch(
    pinia.state,
    (state) => {
      // persist the whole state to the local storage whenever it changes
      localStorage.setItem("builduvs_pinia", JSON.stringify(state));
    },
    { deep: true }
  );

  return pinia;
});
