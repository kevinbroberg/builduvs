import { ref, computed } from 'vue'

// Pointer-based card dragging for the playtest board.
//
// Deliberately NOT HTML5 drag-and-drop: `dragstart` is never fired from touch input on
// iOS Safari or Android Chrome, and no tap gesture unlocks it — a touch-drag is claimed
// by the browser for scrolling. Pointer Events are one code path for mouse, touch and
// pen, and are supported across this project's browser targets (Safari 13+).
//
// Drop targets opt in with a `data-drop-zone="<zone>"` attribute; hit-testing walks up
// from `elementFromPoint`, so nesting (a card inside a grid) resolves to the grid.

const DRAG_THRESHOLD = 6 // px of movement before a press becomes a drag

export function useCardDrag({ onDrop } = {}) {
  const dragging = ref(false)
  const dragInst = ref(null)
  const pos = ref({ x: 0, y: 0 })
  const hoverZone = ref(null)
  const hoverIndex = ref(null)

  // A press that turned into a drag must not also fire the card's click handler
  // (committing a stage card, opening a pile). Consulted by the page, cleared on the
  // next press.
  const suppressClick = ref(false)

  let start = null
  let activeEl = null

  const ghostStyle = computed(() => ({
    left: `${pos.value.x}px`,
    top: `${pos.value.y}px`,
  }))

  function containerAt(x, y) {
    // The ghost is pointer-events:none, so it never shadows the real target.
    const el = document.elementFromPoint(x, y)
    return el?.closest('[data-drop-zone]') || null
  }

  function zoneAt(x, y) {
    return containerAt(x, y)?.getAttribute('data-drop-zone') || null
  }

  // Where in the destination the card would land, for zones that render their cards
  // as a grid. Walks the cards in order and inserts before the first one whose left
  // half the pointer has not yet passed, on a row at or above the pointer — the usual
  // wrapping-grid heuristic. Returns null for piles, which have no visible positions.
  function indexAt(container, x, y) {
    if (!container) return null
    const cards = [...container.querySelectorAll('[data-card-slot]')]
    if (!cards.length) return null
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect()
      if (y < r.bottom && x < r.left + r.width / 2) return i
    }
    return cards.length
  }

  // Controls sitting on top of a card (Play, the ± stat steppers, the menu buttons)
  // own their own presses. A card must not begin a drag from one of them.
  const INTERACTIVE = 'button, .q-btn, .q-menu, input, textarea, select, a[href]'

  function onPointerDown(evt, inst) {
    // Left button / touch / pen only; right-click belongs to the context menu.
    if (evt.button != null && evt.button !== 0) return
    if (evt.target?.closest?.(INTERACTIVE)) return
    suppressClick.value = false
    start = { x: evt.clientX, y: evt.clientY }
    dragInst.value = inst
    activeEl = evt.currentTarget
    // Capture here, not once the drag passes the threshold: handlers live on the card,
    // so without capture the card stops receiving pointermove the moment the pointer
    // leaves it and a drag can never get going. Safe now that presses on in-card
    // controls bail out above — capturing those was what ate their clicks.
    try { activeEl.setPointerCapture?.(evt.pointerId) } catch { /* not capturable */ }
  }

  function onPointerMove(evt) {
    if (!start || !dragInst.value) return
    const dx = evt.clientX - start.x
    const dy = evt.clientY - start.y

    if (!dragging.value) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      dragging.value = true
    }
    // Once dragging, stop the page panning under the finger.
    evt.preventDefault()
    pos.value = { x: evt.clientX, y: evt.clientY }
    const container = containerAt(evt.clientX, evt.clientY)
    hoverZone.value = container?.getAttribute('data-drop-zone') || null
    hoverIndex.value = indexAt(container, evt.clientX, evt.clientY)
  }

  function onPointerUp(evt) {
    // Resolve the drop FIRST. Releasing capture throws if this element doesn't hold
    // it for this pointer id, and that must not be able to swallow the drop.
    if (dragging.value && dragInst.value) {
      const container = containerAt(evt.clientX, evt.clientY)
      const zone = container?.getAttribute('data-drop-zone') || null
      const index = indexAt(container, evt.clientX, evt.clientY)
      // A drop inside the card's own zone is a reorder, which is meaningful in an
      // ordered zone and a no-op anywhere else.
      if (zone && (zone !== dragInst.value.zone || index != null)) {
        // Some views render a zone reversed (the discard browser shows top-of-pile
        // first); the page needs to know in order to map the index back.
        onDrop?.(dragInst.value, zone, index,
          { reversed: container?.dataset?.dropReversed === 'true' })
      }
      suppressClick.value = true
    }
    try { activeEl?.releasePointerCapture?.(evt.pointerId) } catch { /* never captured */ }
    cancel()
  }

  function cancel() {
    dragging.value = false
    dragInst.value = null
    hoverZone.value = null
    hoverIndex.value = null
    start = null
    activeEl = null
  }

  // Bind to each draggable card.
  function handlers(inst) {
    return {
      onPointerdown: (e) => onPointerDown(e, inst),
      onPointermove: onPointerMove,
      onPointerup: onPointerUp,
      onPointercancel: cancel,
    }
  }

  return { dragging, dragInst, hoverZone, hoverIndex, ghostStyle, suppressClick,
    handlers, cancel }
}
