export function increment(state, card, pile = state.deck) {
  let qtyObj = pile[card.asset] || { qty: 0 };
  let count = qtyObj.qty;
  let max = card.limit || 4;
  count = count >= max ? max : count + 1;
  // TODO autosideboard
  pile[card.asset] = { ...card, qty: count}
}
// TODO sideboard
export function decrement(state, card, pile = state.deck) {
  let qtyObj = pile[card.asset] || { qty: 1 };
  let count = qtyObj.qty - 1;
  if (count > 0) {
    pile[card.asset] = { ...card, qty: count }
  } else {
    pile.delete(card.asset)
  }
}
export function send2Board(state, card) {
  this.decrement(state, card, state.deck);
  this.increment(state, card, state.side);
}
export function send2Main(state, card) {
  this.decrement(state, card, state.side);
  this.increment(state, card, state.deck);
}
export function markMain(state, card) {
  state.mainCharacter = card
}
export function remove(state, card, pile = state.deck) {
  pile.delete(card.asset)
}
export function setQty(state, card, qty, pile = state.deck) {
  let max = card.limit || 4;
  let min = 0;
  qty = qty > max ? max : qty;
  qty = qty < min ? min : qty;
  pile[card.asset] = { ...card, qty: qty }
}
