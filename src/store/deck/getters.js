// object from asset => card
export function getDeck (state) {
    return state.deck
}
// list of cards. quantities are in qty attribute of each one
export function getDeckList(state) {
    return Object.keys(state.deck).map(k => state.deck[k])
}
export function getDeckText(state) {
    let name = getMain(state)?.name // mainchar may be undefined
    let main = name ? [{ name: name, qty: 1 }] : [] // if it's not, there is 1 copy in your deck
    return [...main, ...getDeckList(state)].map(c => `${c.qty} ${c.name}`).join('\n')
    // maybe TODO sometime: accumulate additional copies of main char into the 1st quantity, vs 1 Amy... 3 Amy that will happen now
}
export function getMain(state) {
    return state.mainCharacter || undefined
}