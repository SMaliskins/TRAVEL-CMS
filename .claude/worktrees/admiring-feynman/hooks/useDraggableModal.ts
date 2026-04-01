import { useRef, useCallback, useState } from "react";

export function useDraggableModal() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, input, select, textarea, a")) return;
    e.preventDefault();
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      setOffset({
        x: dragState.current.origX + ev.clientX - dragState.current.startX,
        y: dragState.current.origY + ev.clientY - dragState.current.startY,
      });
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [offset.x, offset.y]);

  const resetPosition = useCallback(() => setOffset({ x: 0, y: 0 }), []);

  const modalStyle: React.CSSProperties = offset.x || offset.y
    ? { transform: `translate(${offset.x}px, ${offset.y}px)` }
    : {};

  return { modalStyle, onHeaderMouseDown: onMouseDown, resetPosition };
}
