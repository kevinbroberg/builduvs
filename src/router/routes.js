const routes = [
  {
    path: "/",
    component: () => import("layouts/MainLayout.vue"),
    children: [
      {
        path: "",
        component: () => import('src/pages/AttackHome.vue')
      },
      {
        path: "attack",
        component: () => import('src/pages/AttackHome.vue')
      },
      {
        path: "search",
        component: () => import("pages/CardHome.vue"),
        props: (route) => ({ query: route.query }),
      },
      {
        path: "settings",
        component: () => import('src/pages/Config.vue'),
      },
      {
        path: "mha",
        component: () => import("pages/CardHome.vue"),
        props: (route) => ({ query: { ...route.query, formats: "[\"My Hero Academia\"]" } })
      },
      {
        path: "updog",
        component: () => import("pages/CardHome.vue"),
        props: (route) => ({query: {...route.query, formats: "[\"retro\"]"}})
      },
      {
        path: "retro",
        component: () => import("pages/CardHome.vue"),
        props: (route) => ({query: {...route.query, formats: "[\"retro\"]"}})
      },
      {
        path: "deck",
        component: () => import("src/pages/DeckHome.vue"),
      }
      // { path: 'about', component: () => import('../views/About.vue') },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: "/:catchAll(.*)*",
    component: () => import("pages/Error404.vue"),
  },
];

export default routes;
