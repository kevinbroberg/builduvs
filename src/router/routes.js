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
        path: "/rewards",
        component: () => import("src/pages/RewardsHome.vue"),
      },
    ],
  },
];
export default routes;
