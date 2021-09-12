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
