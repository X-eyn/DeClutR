"use client";

/**
 * Sortable drag canvas — key design decisions:
 *
 * 1. Positions are SNAPSHOTTED at drag-start and never re-read during drag.
 *    getBoundingClientRect() on mid-animation elements returns interpolated
 *    values, causing rapid nearest-card oscillation.  Frozen snapshots fix this.
 *
 * 2. Reorder state is throttled to one update per rAF tick.  Firing syncOrder
 *    every mousemove (60-120/s) interrupts framer-motion before it can measure
 *    before/after positions — that's the flicker.
 *
 * 3. Hysteresis: the active target only changes when a different card becomes
 *    HYSTERESIS_PX closer than the current one.  Eliminates boundary oscillation.
 *
 * 4. Insert logic is simply "place dragged card before nearest card" — no
 *    before/after heuristic that depended on animating cx.
 */

import {
  createContext, useContext, useRef, useState,
  useCallback, useEffect, ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion, MotionConfig } from "framer-motion";

/* ─── Constants ─────────────────────────────────────────── */
export type CardId = string;

export const CARD_SPANS: Record<CardId, number> = {
  stats: 7,     workload: 2,  timealloc: 3,
  heatmap: 4,   timeline: 5,  freetime: 3,
  deadlines: 4, agenda: 4,    calendar: 2,  stack: 2,
};

export const DEFAULT_ORDER: CardId[] = [
  "stats", "workload", "timealloc",
  "heatmap", "timeline", "freetime",
  "deadlines", "agenda", "calendar", "stack",
];

const STORAGE_KEY   = "temporal-order-v5";
const HYSTERESIS_PX = 28; // px — must overcome this to switch target

/* ─── Persistence ───────────────────────────────────────── */
function loadOrder(): CardId[] {
  if (typeof window === "undefined") return [...DEFAULT_ORDER];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as CardId[];
      if (p.length === DEFAULT_ORDER.length && DEFAULT_ORDER.every(id => p.includes(id))) return p;
    }
  } catch {}
  return [...DEFAULT_ORDER];
}

/* ─── Context ───────────────────────────────────────────── */
interface CanvasCtx {
  displayOrder: CardId[];
  dragging: CardId | null;
  dragPos:  { x: number; y: number } | null;
  dragSize: { w: number; h: number };
  startDrag:   (id: CardId, e: React.MouseEvent) => void;
  resetLayout: () => void;
  registerEl:  (id: CardId, el: HTMLElement | null) => void;
}

const Ctx = createContext<CanvasCtx | null>(null);
export const useDragCanvas = () => useContext(Ctx);

/* ─── Spring config — overdamped = no bounce, no flicker ── */
const SPRING = { type: "spring" as const, stiffness: 340, damping: 44, mass: 0.85 };

/* ─── DragCanvas ────────────────────────────────────────── */
export function DragCanvas({ children }: { children: ReactNode }) {
  const [displayOrder, setDisplayOrder] = useState<CardId[]>([...DEFAULT_ORDER]);
  const [dragging,  setDragging]  = useState<CardId | null>(null);
  const [dragPos,   setDragPos]   = useState<{ x: number; y: number } | null>(null);
  const [dragSize,  setDragSize]  = useState({ w: 0, h: 0 });

  /* ---- refs used inside event handlers (no stale-closure risk) ---- */
  const displayOrderRef = useRef<CardId[]>([...DEFAULT_ORDER]);
  const committedRef    = useRef<CardId[]>([...DEFAULT_ORDER]);
  const draggingRef     = useRef<CardId | null>(null);
  const dragOffRef      = useRef({ ox: 0, oy: 0 });
  const elsRef          = useRef<Map<CardId, HTMLElement>>(new Map());

  // Frozen center-point snapshot taken once at drag-start.
  // Never updated during drag — eliminates mid-animation position reads.
  const snapRef    = useRef<Map<CardId, { cx: number; cy: number }>>(new Map());
  // Last card that was "targeted" — used for hysteresis
  const lastTargetRef  = useRef<CardId | null>(null);
  // rAF handle + pending order — ensures at most one layout update per frame
  const rafRef     = useRef(0);
  const pendingRef = useRef<CardId[] | null>(null);

  const syncOrder = useCallback((next: CardId[]) => {
    displayOrderRef.current = next;
    setDisplayOrder(next);
  }, []);

  useEffect(() => {
    const saved = loadOrder();
    syncOrder(saved);
    committedRef.current = saved;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const registerEl = useCallback((id: CardId, el: HTMLElement | null) => {
    if (el) elsRef.current.set(id, el);
    else   elsRef.current.delete(id);
  }, []);

  /* ---- Find the most "stable" target card ---- */
  function pickTarget(cursor: { x: number; y: number }, dragged: CardId): CardId | null {
    let bestId: CardId | null = null;
    let bestD = Infinity;
    for (const [cid, pos] of snapRef.current) {
      if (cid === dragged) continue;
      const d = Math.hypot(cursor.x - pos.cx, cursor.y - pos.cy);
      if (d < bestD) { bestD = d; bestId = cid; }
    }
    if (!bestId) return null;

    // Hysteresis: only switch away from current target if new one is
    // meaningfully closer (prevents oscillation at card boundaries)
    const curr = lastTargetRef.current;
    if (curr && bestId !== curr) {
      const currPos = snapRef.current.get(curr);
      if (currPos) {
        const currD = Math.hypot(cursor.x - currPos.cx, cursor.y - currPos.cy);
        if (currD - bestD < HYSTERESIS_PX) return curr; // stay
      }
    }
    return bestId;
  }

  const startDrag = useCallback((id: CardId, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = elsRef.current.get(id);
    if (!el) return;

    const r = el.getBoundingClientRect();
    dragOffRef.current  = { ox: e.clientX - r.left, oy: e.clientY - r.top };
    setDragSize({ w: r.width, h: r.height });
    setDragPos({ x: r.left, y: r.top });

    // ── Snapshot ALL card centers at this moment (before any animation starts)
    const snap = new Map<CardId, { cx: number; cy: number }>();
    for (const [cid, cel] of elsRef.current) {
      const cr = cel.getBoundingClientRect();
      snap.set(cid, { cx: cr.left + cr.width / 2, cy: cr.top + cr.height / 2 });
    }
    snapRef.current    = snap;
    lastTargetRef.current = null;

    draggingRef.current = id;
    setDragging(id);
    document.body.style.cursor     = "grabbing";
    document.body.style.userSelect = "none";
  }, []);

  /* ---- Global pointer listeners (registered once) ---- */
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const id = draggingRef.current;
      if (!id) return;

      // Overlay position: update every frame for silky cursor tracking
      const { ox, oy } = dragOffRef.current;
      setDragPos({ x: e.clientX - ox, y: e.clientY - oy });

      // Target detection uses frozen snapshot — not live (animated) rects
      const target = pickTarget({ x: e.clientX, y: e.clientY }, id);
      if (!target || target === lastTargetRef.current) return;

      lastTargetRef.current = target;

      // Build new order: insert dragged card just before target
      const curr    = displayOrderRef.current;
      const without = curr.filter(x => x !== id);
      const ti      = without.indexOf(target);
      const next    = [...without.slice(0, ti), id, ...without.slice(ti)];
      if (next.every((v, i) => v === curr[i])) return;

      // Throttle: batch to one update per animation frame
      pendingRef.current = next;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          if (pendingRef.current) {
            syncOrder(pendingRef.current);
            pendingRef.current = null;
          }
        });
      }
    }

    function onUp() {
      if (!draggingRef.current) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      if (pendingRef.current) {
        syncOrder(pendingRef.current);
        pendingRef.current = null;
      }
      committedRef.current = displayOrderRef.current;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(committedRef.current)); } catch {}
      draggingRef.current = null;
      setDragging(null);
      setDragPos(null);
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && draggingRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        pendingRef.current = null;
        syncOrder([...committedRef.current]);
        draggingRef.current   = null;
        lastTargetRef.current = null;
        setDragging(null);
        setDragPos(null);
        document.body.style.cursor     = "";
        document.body.style.userSelect = "";
      }
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("keydown",   onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      window.removeEventListener("keydown",   onKey);
    };
  }, [syncOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetLayout = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    const def = [...DEFAULT_ORDER];
    syncOrder(def);
    committedRef.current = def;
    lastTargetRef.current = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, [syncOrder]);

  return (
    <Ctx.Provider value={{ displayOrder, dragging, dragPos, dragSize, startDrag, resetLayout, registerEl }}>
      <MotionConfig transition={SPRING}>
        {/* layoutRoot tells framer-motion to batch all layout measurements
            inside this subtree together — prevents measurement races       */}
        <motion.div
          layoutRoot
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: 18,
            alignItems: "start",
          }}
        >
          {children}
        </motion.div>
      </MotionConfig>
    </Ctx.Provider>
  );
}

/* ─── DragCard ──────────────────────────────────────────── */
export function DragCard({ id, children }: { id: CardId; children: ReactNode }) {
  const ctx = useDragCanvas();
  const elRef     = useRef<HTMLDivElement>(null);
  const clicksRef = useRef<number[]>([]);
  const [hover,       setHover]       = useState(false);
  const [pendingDrag, setPendingDrag] = useState(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el || !ctx) return;
    ctx.registerEl(id, el);
    return () => ctx.registerEl(id, null);
  }, [id, ctx]);

  useEffect(() => {
    if (!pendingDrag) return;
    const t = setTimeout(() => setPendingDrag(false), 450);
    return () => clearTimeout(t);
  }, [pendingDrag]);

  if (!ctx) {
    return <div style={{ gridColumn: `span ${CARD_SPANS[id] ?? 4}` }}>{children}</div>;
  }

  const span      = CARD_SPANS[id] ?? 4;
  const orderIdx  = ctx.displayOrder.indexOf(id);
  const isDragging = ctx.dragging === id;
  const { dragPos, dragSize } = ctx;

  function handleMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    const now = Date.now();
    const recent = clicksRef.current.filter(t => now - t < 450);
    recent.push(now);
    clicksRef.current = recent;

    if (recent.length === 1) setPendingDrag(true);
    if (recent.length >= 2) {
      clicksRef.current = [];
      setPendingDrag(false);
      ctx!.startDrag(id, e);
    }
  }

  const handleBg = isDragging
    ? "rgba(99,102,241,0.12)"
    : pendingDrag
    ? "rgba(99,102,241,0.09)"
    : hover
    ? "rgba(99,102,241,0.04)"
    : "transparent";

  return (
    <>
      {/* ── Grid slot — animates with FLIP when order changes ── */}
      <motion.div
        ref={elRef}
        layout
        // layout transition is inherited from MotionConfig above
        style={{
          gridColumn: `span ${span}`,
          order: orderIdx,
          position: "relative",
          borderRadius: 18,
          opacity: isDragging ? 0.1 : 1,
          willChange: "transform",
          // Prevent framer-motion from trying to animate opacity/scale as layout
          pointerEvents: isDragging ? "none" : "auto",
        }}
        // Animate opacity separately with a fast tween, not the spring
        animate={{ opacity: isDragging ? 0.1 : 1, scale: isDragging ? 0.97 : 1 }}
        transition={isDragging
          ? { duration: 0.12, ease: "easeOut" }
          : { ...SPRING }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* Drag handle */}
        <div
          onMouseDown={handleMouseDown}
          draggable={false}
          title="Double-click &amp; drag to move"
          style={{
            position: "absolute",
            inset: "0 0 auto 0",
            height: 34,
            zIndex: 20,
            cursor: pendingDrag ? "crosshair" : "grab",
            borderRadius: "18px 18px 0 0",
            background: handleBg,
            transition: "background 0.18s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Grip dots */}
          {(hover || pendingDrag || isDragging) && (
            <div style={{
              display: "flex",
              gap: 5,
              opacity: pendingDrag || isDragging ? 0.6 : 0.25,
              transition: "opacity 0.18s ease",
              pointerEvents: "none",
            }}>
              {[0, 1, 2].map(col => (
                <div key={col} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[0, 1].map(row => (
                    <div
                      key={row}
                      style={{
                        width: 3.5, height: 3.5,
                        borderRadius: "50%",
                        background: "#6366f1",
                        transform: pendingDrag ? "scale(1.35)" : "scale(1)",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
          {pendingDrag && !isDragging && (
            <span style={{
              position: "absolute",
              right: 14,
              fontSize: 10.5,
              fontWeight: 600,
              color: "#6366f1",
              opacity: 0.65,
              letterSpacing: "0.01em",
              pointerEvents: "none",
              userSelect: "none",
            }}>
              click again &amp; drag
            </span>
          )}
        </div>

        {children}
      </motion.div>

      {/* ── Floating card that follows the cursor ── */}
      {isDragging && dragPos && typeof document !== "undefined" && createPortal(
        <div style={{
          position: "fixed",
          left: dragPos.x,
          top: dragPos.y,
          width: dragSize.w,
          pointerEvents: "none",
          zIndex: 9999,
          borderRadius: 18,
          // Crisp shadow — no transition on position (cursor tracking must be instant)
          boxShadow: "0 28px 72px rgba(0,0,0,0.24), 0 8px 28px rgba(99,102,241,0.20)",
          outline: "1.5px solid rgba(99,102,241,0.22)",
          outlineOffset: -1,
          // Subtle lift + tilt
          transform: "scale(1.018) rotate(-0.3deg)",
          transformOrigin: "top center",
        }}>
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}

/* ─── Reset button ──────────────────────────────────────── */
export function ResetLayoutBtn({ style }: { style?: React.CSSProperties }) {
  const ctx = useDragCanvas();
  const [hov, setHov] = useState(false);
  if (!ctx) return null;
  return (
    <button
      onClick={ctx.resetLayout}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Reset card positions to default"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "9px 14px",
        background: hov ? "#f5f4ff" : "white",
        border: `1px solid ${hov ? "#a5b4fc" : "var(--line)"}`,
        borderRadius: 10,
        fontSize: 12.5, fontWeight: 600,
        color: hov ? "#6366f1" : "var(--mut)",
        cursor: "pointer", fontFamily: "inherit",
        transition: "all 0.15s ease",
        ...style,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
      Reset Layout
    </button>
  );
}
