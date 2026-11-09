import { custom } from 'src/js/custom'

// Central place for building browser-tab / history titles.
export const APP_TITLE = custom ? custom.title : 'BuildUVS'

// `setPageTitle('My Deck')` -> "My Deck · BuildUVS"; `setPageTitle()` -> "BuildUVS"
export function setPageTitle(detail) {
  document.title = detail ? `${detail} · ${APP_TITLE}` : APP_TITLE
}
