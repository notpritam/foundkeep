'use client';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { masonryLayout } from '../../../../packages/shared/src/collection-presentation';
import { CaptureCard } from './capture-card';
import type { Capture } from '../../lib/dashboard';

/** Natural card heights with chronological DOM/focus order and a no-JS grid. */
export function MasonryGrid({ items, open, selected, busy }: { items: Capture[]; open: (id: string) => void; selected?: string; busy: boolean }) {
  const grid = useRef<HTMLDivElement>(null);
  const cells = useRef(new Map<string, HTMLDivElement>());
  const [measurement, setMeasurement] = useState({ width: 0, columns: 1, heights: new Map<string, number>() });
  const measure = useCallback(() => {
    const element = grid.current;
    if (!element) return;
    const width = element.clientWidth;
    const minimum = window.matchMedia('(max-width: 680px)').matches ? 155 : element.closest('.has-capture-panel') ? 205 : 240;
    const columns = Math.max(1, Math.floor((width + 18) / (minimum + 18)));
    const heights = new Map<string, number>();
    for (const [id, cell] of cells.current) heights.set(id, Math.ceil(cell.offsetHeight));
    setMeasurement(previous => previous.width === width && previous.columns === columns && previous.heights.size === heights.size && [...heights].every(([id, height]) => previous.heights.get(id) === height) ? previous : { width, columns, heights });
  }, []);
  useLayoutEffect(() => {
    let frame = 0;
    const queue = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(queue);
    if (grid.current) observer.observe(grid.current);
    for (const cell of cells.current.values()) observer.observe(cell);
    measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [items, measure]);
  const layout = masonryLayout(items.map(item => measurement.heights.get(item.id) || 260), measurement.width, measurement.columns, 18);
  const ready = measurement.width > 0;
  return <div ref={grid} className="capture-grid" id="capture-grid" data-layout={ready ? 'masonry' : 'grid'} aria-busy={busy} style={ready ? { display: 'block', position: 'relative', height: layout.height } : undefined}>
    {items.map((capture, index) => <div key={capture.id} data-capture-id={capture.id} ref={element => { if (element) cells.current.set(capture.id, element); else cells.current.delete(capture.id); }} style={ready ? { position: 'absolute', width: layout.items[index]!.width, left: layout.items[index]!.left, top: layout.items[index]!.top } : undefined}>
      <CaptureCard capture={capture} open={open} selected={capture.id === selected} />
    </div>)}
  </div>;
}
