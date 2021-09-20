
export function updateOrigin(state, value) {
  state.selectedOrigins = value
}

export function updateKeywords(state, value) {
  state.selectedKeywords = value
}
export function updateName(state, value) {
  state.nameSelection = value
}

export function clearFilters(state) {
  state.nameSelection = ''
  state.textSelection = ''
  state.selectedSymbols = []
  state.selectedSymbols2 = []
  state.selectedSymbols3 = []
  state.selectedOrigins = []
  state.selectedTypes = []
  state.selectedFormats = []
  state.selectedKeywords = []
}

export function handleQuery(state, query) {
  console.log(`hello query`)
  console.log(query)
  console.log(state)
  // selections. quote-stripping from https://stackoverflow.com/questions/19156148/i-want-to-remove-double-quotes-from-a-string
  state.nameSelection = query.nameSelection      ? stripQuotes(query.nameSelection)  : state.nameSelection
  state.textSelection = query.textSelection      ? stripQuotes(query.textSelection)  : state.textSelection
  state.selectedSymbols = query.selectedSymbols  ? JSON.parse(query.selectedSymbols)  : state.selectedSymbols
  state.selectedSymbols2 = query.selectedSymbols2? JSON.parse(query.selectedSymbols2)  : state.selectedSymbols2
  state.selectedSymbols3 = query.selectedSymbols3? JSON.parse(query.selectedSymbols3)  : state.selectedSymbols3
  state.selectedOrigins = query.selectedOrigins  ? JSON.parse(query.selectedOrigins)  : state.selectedOrigins
  state.selectedTypes = query.selectedTypes      ? JSON.parse(query.selectedTypes)  : state.selectedTypes
  state.selectedKeywords = query.selectedKeywords? JSON.parse(query.selectedKeywords)  : state.selectedKeywords
  state.selectedFormats = query.selectedFormats  ? JSON.parse(query.selectedFormats)  : state.selectedFormats
  
  console.log(state)
}
