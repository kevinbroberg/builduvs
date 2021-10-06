export function increment(state, card) {
  if (card.type == 'character' && !state.face) {
    setFace(state, card)
    return
  } 
  let count = state.deck[card.asset]?.qty || 0
  let max = card.limit || 4;
  count = count >= max ? max : count + 1;
  // TODO autosideboard
  state.deck[card.asset] = { ...card, qty: count}
}
export function incrementSide(state, card) {
  let count = state.side[card.asset]?.qty || 0
  let max = card.limit || 4;
  count = count >= max ? max : count + 1;
  // TODO observe sum of main+side when incrementing
  state.side[card.asset] = { ...card, qty: count}
}
// TODO sideboard
export function decrement(state, card) {
  let qtyObj = state.deck[card.asset] || { qty: 1 };
  let count = qtyObj.qty - 1;
  if (count > 0) {
    state.deck[card.asset] = { ...card, qty: count }
  } else {
    delete state.deck[card.asset]
    if (state.face == card) { state.face = undefined}
  }
}
export function decrementSide(state, card) {
  let qtyObj = state.side[card.asset] || { qty: 1 };
  let count = qtyObj.qty - 1;
  if (count > 0) {
    state.side[card.asset] = { ...card, qty: count }
  } else {
    delete state.side[card.asset]
    if (state.face == card) { state.face = undefined}
  }
}
export function setFace(state, card) {
  state.face = card
}
export function remove(state, card) {
  delete state.deck[card.asset]
}
export function nuke(state) {
  // console.log(`Nuking ${state.deck.length} cards`)
  state.deck = {}
  state.side = {}
  state.face = undefined
  // console.log(`Nuked, with ${state.deck.length} cards left`)
}
export function setQty(state, card, qty) {
  let max = card.limit || 4;
  let min = 0;
  qty = qty > max ? max : qty;
  qty = qty < min ? min : qty;
  state.deck[card.asset] = { ...card, qty: qty }
}

// TODO limit this duplication of code
export function send2Board(state, card) {
  decrement(state, card);
  incrementSide(state, card);
}
export function send2Main(state, card) {
  decrementSide(state, card);
  increment(state, card);
}