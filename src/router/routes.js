const routes = [
  {
    path: "/",
    component: () => import("layouts/MainLayout.vue"),
    children: [
      {
        path: "",
        component: () => import("src/pages/AttackHome.vue"),
        meta: { title: "Game Tracker" },
      },
      {
        path: "/attack",
        component: () => import("src/pages/AttackHome.vue"),
        meta: { title: "Game Tracker" },
      },
      {
        path: "/settings",
        component: () => import("src/pages/ConfigHome.vue"),
        meta: { title: "Settings" },
      },
      {
        path: "/cards",
        component: () => import("src/pages/CardHome.vue"),
        props: (route) => ({ query: route.query }),
        meta: { title: "Card Search" },
      },
      {
        path: "/deck",
        component: () => import("src/pages/DeckHome.vue"),
        meta: { title: "Your Deck" },
      },
      {
        path: "/shuffle",
        component: () => import("src/pages/ShuffleHome.vue"),
        meta: { title: "Shuffle Tool" },
      },
      {
        path: "/compare",
        component: () => import("src/pages/DeckCompare.vue"),
        meta: { title: "Compare Decks" },
      },
      { path: "/locals",              redirect: "/lists" },
      { path: "/locals/:event",       redirect: to => `/lists/${to.params.event}` },
      { path: "/locals/:event/:id",   redirect: to => `/lists/${to.params.event}/${to.params.id}` },
      {
        path: "/lists",
        component: () => import("src/pages/LocalsPage.vue"),
        meta: { title: "Decklists" },
      },
      {
        path: "/lists/:event",
        component: () => import("src/pages/LocalsPage.vue"),
        meta: { title: "Decklists" },
      },
      {
        path: "/lists/:event/:id",
        component: () => import("src/pages/LocalsPage.vue"),
        meta: { title: "Decklists" },
      },
      // Unknown URLs (typos, stale links) fall back to the home tracker
      // instead of rendering an empty layout.
      { path: "/:catchAll(.*)*", redirect: "/" },
    ],
  },
];
export default routes;
