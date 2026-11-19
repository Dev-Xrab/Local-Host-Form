// Drag-to-reorder for the form builder (web). Grab a card's handle, drag it, and release where the
// blue line is. Dragging a section carries the questions under it, like Google Forms.
//
// It works on the DOM because every card already has the element id `question-<id>` (also used to
// scroll to it), and measuring those is simpler and exact; nothing here touches React state until
// the drop, when `onDrop` gets the id and the index to insert at.

export interface DragItem { id: string; isSection: boolean }

const EDGE = 80;
const MAX_SCROLL = 18;

const cardOf = (id: string) => document.getElementById(`question-${id}`);

function scrollParentOf(el: HTMLElement | null): HTMLElement {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return document.scrollingElement as HTMLElement;
}

/** Start a drag from the handle's pointerdown event. */
export function startDrag(event: PointerEvent, items: DragItem[], id: string, onDrop: (id: string, toIndex: number) => void) {
  const from = items.findIndex((it) => it.id === id);
  const card = cardOf(id);
  if (from === -1 || !card || event.button > 0) return;
  event.preventDefault();

  // The dragged block: a section plus everything up to the next section, otherwise just itself.
  let end = from + 1;
  if (items[from].isSection) while (end < items.length && !items[end].isSection) end++;

  // Positions it may be dropped at: before item `p` (0..n). A section may only land before another
  // section or at the very end, and neither may land inside its own block.
  const candidates: number[] = [];
  for (let p = 0; p <= items.length; p++) {
    if (p > from && p < end) continue;
    if (items[from].isSection && p < items.length && !items[p].isSection) continue;
    candidates.push(p);
  }

  const boundaryY = (p: number) => {
    if (p < items.length) { const r = cardOf(items[p].id)?.getBoundingClientRect(); return r ? r.top - 6 : Infinity; }
    const r = cardOf(items[items.length - 1].id)?.getBoundingClientRect();
    return r ? r.bottom + 6 : Infinity;
  };

  const rect = card.getBoundingClientRect();
  const grabOffset = event.clientY - rect.top;
  const ghost = card.cloneNode(true) as HTMLElement;
  ghost.removeAttribute("id");
  ghost.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  Object.assign(ghost.style, { position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, margin: "0", zIndex: "9999", pointerEvents: "none", opacity: "0.92", boxShadow: "0 8px 28px rgba(0,0,0,.35)", cursor: "grabbing" });
  const line = document.createElement("div");
  Object.assign(line.style, { position: "fixed", height: "3px", borderRadius: "2px", background: "#4285F4", zIndex: "9998", pointerEvents: "none", left: `${rect.left}px`, width: `${rect.width}px` });
  document.body.append(ghost, line);
  for (let i = from; i < end; i++) { const el = cardOf(items[i].id); if (el) el.style.opacity = "0.35"; }
  const previousCursor = document.body.style.cursor;
  document.body.style.cursor = "grabbing";

  const scroller = scrollParentOf(card);
  let pointerY = event.clientY;
  let target = from;
  let raf = 0;

  const update = () => {
    ghost.style.top = `${pointerY - grabOffset}px`;
    const probe = pointerY - grabOffset + Math.min(rect.height, 60) / 2; // the ghost's upper part decides the slot
    let best = candidates[0];
    let bestDistance = Infinity;
    for (const p of candidates) {
      const d = Math.abs(boundaryY(p) - probe);
      if (d < bestDistance) { best = p; bestDistance = d; }
    }
    target = best;
    line.style.top = `${boundaryY(target) - 1.5}px`;
  };

  // Keeps scrolling while the pointer rests near the top or bottom edge of the page.
  const tick = () => {
    const bounds = scroller === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
    let delta = 0;
    if (pointerY < bounds.top + EDGE) delta = -MAX_SCROLL * Math.min(1, (bounds.top + EDGE - pointerY) / EDGE);
    else if (pointerY > bounds.bottom - EDGE) delta = MAX_SCROLL * Math.min(1, (pointerY - (bounds.bottom - EDGE)) / EDGE);
    if (delta) { scroller.scrollTop += delta; update(); }
    raf = requestAnimationFrame(tick);
  };

  const move = (e: PointerEvent) => { pointerY = e.clientY; update(); };
  const finish = (commit: boolean) => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key);
    ghost.remove();
    line.remove();
    for (let i = from; i < end; i++) { const el = cardOf(items[i].id); if (el) el.style.opacity = ""; }
    document.body.style.cursor = previousCursor;
    if (commit && target !== from && target !== end) onDrop(id, target);
  };
  const up = () => finish(true);
  const cancel = () => finish(false);
  const key = (e: KeyboardEvent) => { if (e.key === "Escape") finish(false); };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key);
  update();
  raf = requestAnimationFrame(tick);
}
