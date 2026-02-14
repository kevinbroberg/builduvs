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
    ],
  },
];
export default routes;
