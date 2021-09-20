
import cards from 'assets/cards.json'

export function nameFilter(state) {
    let val = state.nameSelection
    return card => { 
        if (val && val.length > 0) {
            let frontanchor = val.startsWith('^') ? '^' : '.*'
            let backanchor = val.endsWith('$') ? '$' : '.*'
            const regex = new RegExp(frontanchor + val + backanchor, 'i')
            return regex.test(card.name)
        } else {
            return true
        }
    }
}

export function originFilter(state) { 
    let sel = state.selectedOrigins
    return card => {
        if (sel && sel.length > 0) {
            return card.extension.includes(sel)
        } else {
            return true
        }
    }
}

export function keywordFilter(state) {
    let sel = state.selectedKeywords
    return card => {
        if (sel && sel.length > 0) {
            return card.keywords && card.keywords.some(cardKeyword => sel.some(choice => cardKeyword.includes(choice)))
        } else {
            return true
        }
    }
}

export function symbolFilterGenerator(x) {
    return (state) => {
        let selections = state['symbolSelections' + x]
        return (card) => {
            if (selections && selections.length > 0) {
                return card.resources.some(sym => selections.includes(sym.toLowerCase()))
            } else {
                return true
            }
        }
    }
}

export function typeMatchFilter(state) { 
    return card => {
        if (state.selectedTypes && state.selectedTypes.length > 0) {
            return state.selectedTypes.includes(card.type)
        } else {
            return true
        }
    }
}
export function formatMatchFilter(state) { 
    return card => {
        if (state.selectedFormats && state.selectedFormats.length > 0) {
            return card.formats && 
                card.formats.some(format => state.selectedFormats.includes(format))
        } else {
            return true
        }
    }
}
export function textFilter(state) {
    return card => {
        let sel = state.textSelection
        if (sel && sel.length > 0) {
            if (textSelection == "NONE") {
                return !card.text
            } else {
                let frontanchor = sel.startsWith('^') ? '^' : '.*'
                let backanchor = sel.endsWith('$') ? '$' : '.*'
                const regex = new RegExp(frontanchor + sel + backanchor, 'i')
                return regex.test(card.text)
            }
        } else {
            return true
        }
    }
}

const filters = [
    
    nameFilter,
    // caller reverted
    // originFilter,
    // keywordFilter,

    // not implemented
    // symbolFilterGenerator(''), // PUKE
    // symbolFilterGenerator('2'), 
    // symbolFilterGenerator('3'),
    // textFilter,
    // typeMatchFilter,
    // formatMatchFilter,
    ]

export function allFiltersMatch(state) {
    return card => {
        return filters.every(function(f) {
            try {
                return f(state)(card)
            } catch (e) {
                console.error('Error on ' + card.name + ': ' + e.message)
                return false
            }
        })
    }
}

export function filteredCards(state) { 
    return cards.filter(card => allFiltersMatch(state)(card))
}

