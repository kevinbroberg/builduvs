import { defineStore } from "pinia";

export const useConfigStore = defineStore("config", {
  state: () => ({
    speed: 4,
    damage: 5,
    zone: "mid",
    p1name: "Me",
    p2name: "You",
    // TODO: formerly contained p1hp and p2hp as starting health totals; they've been moved into player config
  }),
});
