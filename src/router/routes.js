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
    ],
  },
];
export default routes;
