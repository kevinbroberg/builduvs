import { defineStore } from "pinia";
// import { LocalStorage } from "quasar";

class Damage {
  constructor(title, value) {
    this.title = title;
    this.value = value;
  }
  static up() {
    return new Damage("tap", 1);
  }
  static down() {
    return new Damage("tap", -1);
  }
  static unblocked(x) {
    return new Damage("hit", -x);
  }
  static partialBlock(x) {
    let dmg = (x % 2) + ((x / 2) | 0);
    return new Damage("partial", -dmg);
  }
}

const playerArgs = {
  state: () => ({
    history: [],
    health: 30,
  }),

  getters: {
    lastHit: (state) =>
      state.history?.length ? state.history.at(-1).value : "",
  },

  actions: {
    increment() {
      let d = Damage.up();
      this.health++;

      if (this.history.length && this.history.at(-1)?.title === d.title) {
        this.history.at(-1).value++;
      } else {
        this.history.push(d);
      }
    },
    decrement() {
      let d = Damage.down();
      this.health--;

      // mystery; mixing increment and decrements does not bump more history items
      if (this.history.length && this.history.at(-1)?.title === d.title) {
        this.history.at(-1).value--;
      } else {
        this.history.push(d);
      }
    },
    /**
     * Handles damage dealt to a player by an unblocked attack
     * @param {int} damage the attack's damage (typically positive)
     */
    unblocked(damage) {
      let d = Damage.unblocked(damage);
      this.health += d.value;
      this.history.push(d);
    },
    /**
     * Handles damage dealt to a player by a partially-blocked attack
     * @param {int} damage the attack's damage (typically positive)
     */
    partialBlock(damage) {
      let d = Damage.partialBlock(damage);
      this.health += d.value;
      this.history.push(d);
    },
    /**
     * Reverts the last change to this player's health.
     * Repeat ++ or -- are batched and will be undone at once
     */
    undo() {
      let last = this.history.pop();
      if (last) this.health -= last.value;
    },
    reset() {
      // wtf this is still such a sussy way to clear an array
      this.history.length = 0;
      // TODO starting HP
      this.health = 30;
    },
  },
};

const usePlayer1Store = defineStore("player1", playerArgs);
const usePlayer2Store = defineStore("player2", playerArgs);

export { usePlayer1Store, usePlayer2Store };
