const routes = [
  {
    path: "/",
    component: () => import("layouts/MainLayout.vue"),
    children: [
      {
        path: "",
        component: () => import("src/pages/AttackHome.vue"),
      },
      {
        path: "/attack",
        component: () => import("src/pages/AttackHome.vue"),
      },
      {
        path: "/settings",
        component: () => import("src/pages/ConfigHome.vue"),
      },
      {
        path: "/cards",
        component: () => import("src/pages/CardHome.vue"),
        props: (route) => ({ query: route.query }),
      },
      {
        path: "/deck",
        component: () => import("src/pages/DeckHome.vue"),
      },
      {
        path: "/shuffle",
        component: () => import("src/pages/ShuffleHome.vue"),
      },
      {
        path: "/compare",
        component: () => import("src/pages/DeckCompare.vue"),
      },
      {
        path: "/locals",
        component: () => import("src/pages/LocalsPage.vue"),
      },
      {
        path: "/locals/:event",
        component: () => import("src/pages/LocalsPage.vue"),
      },
      {
        path: "/locals/:event/:id",
        component: () => import("src/pages/LocalsPage.vue"),
      },
    ],
  },
];
export default routes;
