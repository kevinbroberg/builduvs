export function hasDeck (state) {
    return Object.keys(state.deck)?.length > 0
}
export function hasSide (state) {
    return Object.keys(state.side)?.length > 0
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
    let face = getFace(state) // mainchar may be undefined
    let faceObj = face ? [{ name: face.name, qty: quantity(state)(face.asset) }] : []
    let deck = [...faceObj, 
        ...getDeckList(state).filter(c => c.asset != face.asset)
    ].map(c => `${c.qty} ${c.name}`)
    
    let side = hasSide(state) ? ['sideboard', ...getSideList(state).map(c => `${c.qty} ${c.name}`)] : []
    return [...deck, ...side ].join('\n')
}
export function getFace(state) {
    return state.face || undefined
}
export function quantity(state) {
    return (asset) => {
        if (!state?.deck) {
            return 0
        }
        let card = state.deck[asset];
        let qty = card ? card.qty : 0;
        if (getFace(state)?.asset == asset) {
            qty += 1
        }
        return qty
        
    }
}
// TODO amMain(card) { return true iff main is defined and equals card }
