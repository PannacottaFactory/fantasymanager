/**
 * Drag a whole table row with the mouse (or its ⠿ grip on touch): a copy of the row follows the pointer and the
 * element under it is reported through `data-drop-group` (a box) and `data-row-id` (a row). Display only.
 */
import { useState, type PointerEvent as ReactPointerEvent } from 'react';

export type DropPos = 'before' | 'on' | 'after';

export interface RowDrag<G extends string> {
  id: string;
  group?: G;
  row?: string;
  /** Where on the row: its top edge (insert before), middle (swap) or bottom edge (insert after). */
  pos?: DropPos;
}

// Buttons and links stay clickable (a drag only starts after the pointer moves); menus and fields keep the pointer.
const INTERACTIVE = 'select, input, textarea';

export function useRowDrag<G extends string>(onDrop: (id: string, target: { group: G; row?: string; pos?: DropPos }) => void) {
  const [drag, setDrag] = useState<RowDrag<G> | null>(null);

  const start = (e: ReactPointerEvent<HTMLTableRowElement>, id: string) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(INTERACTIVE)) return;
    if (e.pointerType !== 'mouse' && !target.closest('.drag-grip')) return;
    if (e.pointerType === 'mouse') e.preventDefault(); // no text selection while dragging
    const tr = e.currentTarget;
    const rect = tr.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    let ghost: HTMLDivElement | null = null;
    let cur: { group?: G; row?: string; pos?: DropPos } = {};

    const begin = () => {
      const clone = tr.cloneNode(true) as HTMLTableRowElement;
      [...tr.children].forEach((td, i) => ((clone.children[i] as HTMLElement).style.width = `${td.getBoundingClientRect().width}px`));
      const from = tr.querySelectorAll('select');
      clone.querySelectorAll('select').forEach((s, i) => (s.value = from[i]?.value ?? s.value));
      clone.classList.remove('dim');
      const table = document.createElement('table');
      table.className = 'data';
      const body = document.createElement('tbody');
      body.appendChild(clone);
      table.appendChild(body);
      ghost = document.createElement('div');
      ghost.className = 'row-ghost';
      ghost.style.width = `${rect.width}px`;
      ghost.appendChild(table);
      document.body.appendChild(ghost);
      document.body.classList.add('row-dragging');
      setDrag({ id });
    };
    const move = (ev: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        begin();
      }
      // The copy hangs just below the pointer, so the drop line under it stays visible.
      ghost!.style.transform = `translate(${rect.left + ev.clientX - sx}px, ${ev.clientY + 14}px) rotate(-0.6deg)`;
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const group = el?.closest<HTMLElement>('[data-drop-group]')?.dataset.dropGroup as G | undefined;
      const hitTr = el?.closest<HTMLElement>('tr[data-row-id]');
      const hit = hitTr?.dataset.rowId;
      const row = hit && hit !== id ? hit : undefined;
      let pos: DropPos | undefined;
      if (row && hitTr) {
        const r = hitTr.getBoundingClientRect();
        const f = (ev.clientY - r.top) / r.height;
        pos = f < 0.3 ? 'before' : f > 0.7 ? 'after' : 'on';
      }
      if (group !== cur.group || row !== cur.row || pos !== cur.pos) {
        cur = { group, row, pos };
        setDrag({ id, ...cur });
      }
      if (ev.clientY < 70) window.scrollBy(0, -14);
      else if (ev.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
    };
    const finish = (drop: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (ghost) {
        ghost.remove();
        document.body.classList.remove('row-dragging');
        if (drop && cur.group) onDrop(id, { group: cur.group, row: cur.row, pos: cur.pos });
      }
      setDrag(null);
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  return { drag, start };
}
