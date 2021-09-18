// object from asset => card
export function getDeck (state) {
    return state.deck
}
// list of cards. quantities are in qty attribute of each one
export function getDeckList(state) {
    return Object.keys(state.deck).map(k => state.deck[k])
}
export function getDeckText(state) {
    return getDeckList(state).map(c => `${c.qty} ${c.name}`).join('\n')
}
export function getMain(state) {
    return state.mainCharacter || ""
}