import { defineStore } from "pinia";
import { Damage } from "src/utils/damage";

export const useGameStore = defineStore("game", {
  state: () => ({
    // Attack configuration defaults
    defaultSpeed: 4,
    defaultDamage: 5,
    defaultZone: "mid",

    // Player 1 state
    player1: {
      name: "Me",
      health: 30,
      startingHealth: 30,
      history: [],
    },

    // Player 2 state
    player2: {
      name: "You",
      health: 30,
      startingHealth: 30,
      history: [],
    },
  }),

  getters: {
    player1LastHit: (state) =>
      state.player1.history?.length ? state.player1.history.at(-1).value : "",
    player2LastHit: (state) =>
      state.player2.history?.length ? state.player2.history.at(-1).value : "",
  },

  actions: {
    // ===== CONFIG ACTIONS =====

    setDefaultSpeed(value) {
      this.defaultSpeed = value;
    },

    setDefaultDamage(value) {
      this.defaultDamage = value;
    },

    setDefaultZone(value) {
      this.defaultZone = value;
    },

    incrementDefaultSpeed() {
      this.defaultSpeed++;
    },

    decrementDefaultSpeed() {
      this.defaultSpeed--;
    },

    incrementDefaultDamage() {
      this.defaultDamage++;
    },

    decrementDefaultDamage() {
      this.defaultDamage--;
    },

    // ===== PLAYER NAME ACTIONS =====

    setPlayer1Name(value) {
      this.player1.name = value;
    },

    setPlayer2Name(value) {
      this.player2.name = value;
    },

    // ===== PLAYER 1 ACTIONS =====

    incrementPlayer1() {
      let d = Damage.up();
      this.player1.health++;

      if (
        this.player1.history.length &&
        this.player1.history.at(-1)?.title === d.title
      ) {
        this.player1.history.at(-1).value++;
      } else {
        this.player1.history.push(d);
      }
    },

    decrementPlayer1() {
      let d = Damage.down();
      this.player1.health--;

      if (
        this.player1.history.length &&
        this.player1.history.at(-1)?.title === d.title
      ) {
        this.player1.history.at(-1).value--;
      } else {
        this.player1.history.push(d);
      }
    },

    /**
     * Handles damage dealt to player 1 by an unblocked attack
     * @param {number} damage - The attack's damage (typically positive)
     */
    player1Unblocked(damage) {
      let d = Damage.unblocked(damage);
      this.player1.health += d.value;
      this.player1.history.push(d);
    },

    /**
     * Handles damage dealt to player 1 by a partially-blocked attack
     * @param {number} damage - The attack's damage (typically positive)
     */
    player1PartialBlock(damage) {
      let d = Damage.partialBlock(damage);
      this.player1.health += d.value;
      this.player1.history.push(d);
    },

    /**
     * Reverts the last change to player 1's health
     */
    undoPlayer1() {
      let last = this.player1.history.pop();
      if (last) this.player1.health -= last.value;
    },

    resetPlayer1() {
      this.player1.history.length = 0;
      this.player1.health = this.player1.startingHealth;
    },

    setPlayer1StartingHealth(value) {
      this.player1.startingHealth = value;
    },

    incrementPlayer1StartingHealth() {
      this.player1.startingHealth++;
    },

    decrementPlayer1StartingHealth() {
      this.player1.startingHealth--;
    },

    // ===== PLAYER 2 ACTIONS =====

    incrementPlayer2() {
      let d = Damage.up();
      this.player2.health++;

      if (
        this.player2.history.length &&
        this.player2.history.at(-1)?.title === d.title
      ) {
        this.player2.history.at(-1).value++;
      } else {
        this.player2.history.push(d);
      }
    },

    decrementPlayer2() {
      let d = Damage.down();
      this.player2.health--;

      if (
        this.player2.history.length &&
        this.player2.history.at(-1)?.title === d.title
      ) {
        this.player2.history.at(-1).value--;
      } else {
        this.player2.history.push(d);
      }
    },

    /**
     * Handles damage dealt to player 2 by an unblocked attack
     * @param {number} damage - The attack's damage (typically positive)
     */
    player2Unblocked(damage) {
      let d = Damage.unblocked(damage);
      this.player2.health += d.value;
      this.player2.history.push(d);
    },

    /**
     * Handles damage dealt to player 2 by a partially-blocked attack
     * @param {number} damage - The attack's damage (typically positive)
     */
    player2PartialBlock(damage) {
      let d = Damage.partialBlock(damage);
      this.player2.health += d.value;
      this.player2.history.push(d);
    },

    /**
     * Reverts the last change to player 2's health
     */
    undoPlayer2() {
      let last = this.player2.history.pop();
      if (last) this.player2.health -= last.value;
    },

    resetPlayer2() {
      this.player2.history.length = 0;
      this.player2.health = this.player2.startingHealth;
    },

    setPlayer2StartingHealth(value) {
      this.player2.startingHealth = value;
    },

    incrementPlayer2StartingHealth() {
      this.player2.startingHealth++;
    },

    decrementPlayer2StartingHealth() {
      this.player2.startingHealth--;
    },
  },
});
