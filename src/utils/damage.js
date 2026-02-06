/**
 * Represents a change to a player's health with contextual information
 */
export class Damage {
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

/**
 * Calculate half damage (rounds down for even numbers, rounds up for odd)
 * @param {number} x - The damage amount
 * @returns {number} Half damage rounded appropriately
 */
export function calculateHalfDamage(x) {
  return (x % 2) + ((x / 2) | 0);
}
