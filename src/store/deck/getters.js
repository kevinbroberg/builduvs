export function hasDeck (state) {
    return state.deck.keys.length > 0
}
export function hasSide (state) {
    return state.side.keys.length > 0
}
// object from asset => card
export function getDeck (state) {
    return state.deck
}
export function getSide (state) {
    return state.side
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
    let deck = [...face, ...getDeckList(state)].map(c => `${c.qty} ${c.name}`)
    
    let side = hasSide(state) ? ['sideboard', ...getSideList(state).map(c => `${c.qty} ${c.name}`)] : []
    // maybe TODO sometime: accumulate additional copies of main char into the 1st quantity, vs 1 Amy... 3 Amy that will happen now
    // a possible method: simply increment() face before exporting? or have a general dedupe method, and prepend face to the list before dedupe
    return [...deck, ...side ].join('\n')
}
export function getFace(state) {
    return state.face || undefined
}
// TODO amMain(card) { return true iff main is defined and equals card }
