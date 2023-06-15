import { defineStore } from "pinia";

export const useConfigStore = defineStore("config", {
  state: () => ({
    speed: 4,
    damage: 5,
    zone: "mid",
    p1hp: 30,
    p1name: "Me",
    p2hp: 30,
    p2name: "You",
  }),
});
