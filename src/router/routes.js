const routes = [
  {
    path: "/",
    component: () => import("layouts/MainLayout.vue"),
    children: [
      {
        path: "",
        component: () => import("pages/CardHome.vue"),
        props: (route) => ({ query: route.query }),
      },
      {
        path: "mha",
        component: () => import("pages/CardHome.vue"),
        // http://localhost:8080/mha?formats=%5B%22My%20Hero%20Academia%22%5D
        props: (route) => ({ query: { ...route.query, formats: "[\"My Hero Academia\"]" } })
      },
      {
        path: "mha/attack",
        component: () => import('src/pages/AttackHome.vue')
      },
      // {
      //   path: "config",
      //   component: () => import("pages/Config.vue"),
      // },
      {
        path: "deck",
        component: () => import("src/pages/DeckHome.vue"),
      },
      {
        path: "attack",
        component: () => import('src/pages/AttackHome.vue')
      }
      // { path: 'deck', component: () => import('../views/DeckDataGrid.vue') },
      // { path: 'load', component: () => import('../components/deckloader/DeckLoader.vue') },
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
