// object from asset => card
export function getDeck (state) {
    return state.deck
}
// list of cards. quantities are in qty attribute of each one
export function getDeckList(state) {
    return Object.keys(state.deck).map(k => state.deck[k])
}
export function getSideList(state) {
    return Object.keys(state.side).map(k => state.side[k])
}
export function getDeckText(state) {
    let name = getFace(state)?.name // mainchar may be undefined
    let face = name ? [{ name: name, qty: 1 }] : [] // if it's not, there is 1 copy in your deck
    let side = getSideList(state) ? ['sideboard', ...getSideList(state)] : []
    return [...face, ...getDeckList(state), ...side].map(c => `${c.qty} ${c.name}`).join('\n')
    // maybe TODO sometime: accumulate additional copies of main char into the 1st quantity, vs 1 Amy... 3 Amy that will happen now
}
export function getFace(state) {
    return state.face || undefined
}
// TODO amMain(card) { return true iff main is defined and equals card }