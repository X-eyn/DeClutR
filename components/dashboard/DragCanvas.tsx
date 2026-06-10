"use client";

import {
  Children,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type CardId = string;

export const CARD_SPANS: Record<CardId, number> = {
  "stat-critical": 3,
  "stat-today": 3,
  "stat-week": 3,
  "stat-month": 3,
  workload: 4,
  timealloc: 4,
  heatmap: 6,
  timeline: 6,
  freetime: 4,
  deadlines: 4,
  agenda: 4,
  calendar: 3,
  quicknotes: 3,
  insights: 3,
};

export const DEFAULT_ORDER: CardId[] = [
  "stat-critical",
  "stat-today",
  "stat-week",
  "stat-month",
  "workload",
  "timealloc",
  "heatmap",
  "timeline",
  "freetime",
  "deadlines",
  "agenda",
  "calendar",
  "quicknotes",
  "insights",
];

const STORAGE_KEY = "temporal-order-v6";
const RESET_EVENT = "temporal-dashboard-reset-layout";
const SORT_TRANSITION = {
  duration: 260,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
};

interface DragCardProps {
  id: CardId;
  children: ReactNode;
}

function loadOrder() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [...DEFAULT_ORDER];

    const parsed = JSON.parse(stored) as CardId[];
    const isComplete =
      parsed.length === DEFAULT_ORDER.length &&
      DEFAULT_ORDER.every(id => parsed.includes(id));

    return isComplete ? parsed : [...DEFAULT_ORDER];
  } catch {
    return [...DEFAULT_ORDER];
  }
}

function cardElements(children: ReactNode) {
  return Children.toArray(children).filter(
    (child): child is ReactElement<DragCardProps> =>
      isValidElement<DragCardProps>(child) && typeof child.props.id === "string",
  );
}

export function DragCanvas({ children }: { children: ReactNode }) {
  const cards = cardElements(children);
  const cardsById = new Map(cards.map(card => [card.props.id, card]));
  const [order, setOrder] = useState<CardId[]>([...DEFAULT_ORDER]);
  const [activeId, setActiveId] = useState<CardId | null>(null);
  const [overlayWidth, setOverlayWidth] = useState<number | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOrder(loadOrder()));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function handleReset() {
      setOrder([...DEFAULT_ORDER]);
    }

    window.addEventListener(RESET_EVENT, handleReset);
    return () => window.removeEventListener(RESET_EVENT, handleReset);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 7 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const collisionDetection: CollisionDetection = args => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
  };

  function finishDrag({ active, over }: DragEndEvent) {
    setActiveId(null);
    setOverlayWidth(null);

    if (!over || active.id === over.id) return;

    setOrder(current => {
      const oldIndex = current.indexOf(String(active.id));
      const newIndex = current.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return current;

      const next = arrayMove(current, oldIndex, newIndex);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Dragging should still work when browser storage is unavailable.
      }
      return next;
    });
  }

  function startDrag({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setOverlayWidth(active.rect.current.initial?.width ?? null);
  }

  const orderedCards = order
    .map(id => cardsById.get(id))
    .filter((card): card is ReactElement<DragCardProps> => Boolean(card));
  const activeCard = activeId ? cardsById.get(activeId) : undefined;

  return (
    <>
      <style>{`
        .drag-canvas-grid {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 18px;
          align-items: stretch;
          isolation: isolate;
        }
        .drag-canvas-card {
          position: relative;
          min-width: 0;
          padding-top: 12px;
          border-radius: 18px;
          transform-origin: center center;
        }
        .drag-canvas-card-content {
          height: 100%;
          min-width: 0;
        }
        .drag-canvas-card.dragging {
          z-index: 2;
        }
        .drag-canvas-placeholder {
          height: 100%;
          min-height: 100px;
          border: 1.5px dashed rgba(99, 102, 241, 0.34);
          border-radius: 18px;
          background: rgba(99, 102, 241, 0.055);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.7);
        }
        .drag-canvas-handle {
          position: absolute;
          z-index: 30;
          top: 0;
          left: 50%;
          width: 52px;
          height: 24px;
          padding: 0;
          border: 1px solid transparent;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: #818cf8;
          background: rgba(255, 255, 255, 0.82);
          box-shadow: 0 3px 12px rgba(15, 23, 42, 0);
          cursor: grab;
          touch-action: none;
          user-select: none;
          opacity: 0;
          transform: translate(-50%, -2px) scale(0.92);
          transition:
            opacity 160ms ease,
            transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
            border-color 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }
        .drag-canvas-card:hover .drag-canvas-handle,
        .drag-canvas-handle:focus-visible,
        .drag-canvas-card.dragging .drag-canvas-handle {
          opacity: 1;
          transform: translate(-50%, 0) scale(1);
          border-color: rgba(129, 140, 248, 0.28);
          box-shadow: 0 5px 18px rgba(99, 102, 241, 0.14);
        }
        .drag-canvas-handle:hover {
          color: #4f46e5;
          background: #f7f7ff;
        }
        .drag-canvas-handle:active {
          cursor: grabbing;
          transform: translate(-50%, 0) scale(0.96);
        }
        .drag-canvas-handle:focus-visible {
          outline: 3px solid rgba(99, 102, 241, 0.22);
          outline-offset: 2px;
        }
        .drag-canvas-grip {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: currentColor;
          box-shadow:
            6px 0 0 currentColor,
            12px 0 0 currentColor,
            0 6px 0 currentColor,
            6px 6px 0 currentColor,
            12px 6px 0 currentColor;
          transform: translate(-6px, -3px);
        }
        .drag-overlay-card {
          pointer-events: none;
          border-radius: 18px;
          transform: rotate(-0.35deg) scale(1.012);
          transform-origin: center top;
          filter: saturate(1.03);
          box-shadow:
            0 32px 80px rgba(15, 23, 42, 0.24),
            0 12px 34px rgba(79, 70, 229, 0.18);
        }
        @media (max-width: 1180px) {
          .drag-canvas-card {
            grid-column: span 6 !important;
          }
        }
        @media (max-width: 720px) {
          .drag-canvas-grid {
            gap: 14px;
          }
          .drag-canvas-card {
            grid-column: 1 / -1 !important;
          }
          .drag-canvas-handle {
            opacity: 0.78;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .drag-canvas-card,
          .drag-canvas-handle {
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={startDrag}
        onDragCancel={() => {
          setActiveId(null);
          setOverlayWidth(null);
        }}
        onDragEnd={finishDrag}
      >
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className="drag-canvas-grid">{orderedCards}</div>
        </SortableContext>

        <DragOverlay
          adjustScale={false}
          dropAnimation={null}
          zIndex={9999}
        >
          {activeCard ? (
            <div
              className="drag-overlay-card"
              style={{ width: overlayWidth ?? undefined }}
            >
              {activeCard.props.children}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

export function DragCard({ id, children }: DragCardProps) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    transition: SORT_TRANSITION,
  });

  const span = CARD_SPANS[id] ?? 4;
  const style = {
    gridColumn: `span ${span}`,
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.98 : 1,
    willChange: transform ? "transform" : "auto",
  } as CSSProperties;

  return (
    <div
      ref={setNodeRef}
      className={`drag-canvas-card${isDragging ? " dragging" : ""}`}
      style={style}
      data-card-id={id}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="drag-canvas-handle"
        aria-label={`Move ${id.replaceAll("-", " ")} card`}
        title="Drag to reposition"
        onClick={event => event.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <span className="drag-canvas-grip" aria-hidden="true" />
      </button>
      {isDragging ? (
        <div className="drag-canvas-placeholder" aria-hidden="true" />
      ) : (
        <div className="drag-canvas-card-content">{children}</div>
      )}
    </div>
  );
}

export function ResetLayoutBtn({ style }: { style?: CSSProperties }) {
  const [hovered, setHovered] = useState(false);

  function resetLayout() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The in-memory reset still applies when storage is unavailable.
    }
    window.dispatchEvent(new Event(RESET_EVENT));
  }

  return (
    <button
      type="button"
      onClick={resetLayout}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Reset card positions to default"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 14px",
        background: hovered ? "#f5f4ff" : "white",
        border: `1px solid ${hovered ? "#a5b4fc" : "var(--line)"}`,
        borderRadius: 10,
        fontSize: 12.5,
        fontWeight: 600,
        color: hovered ? "#6366f1" : "var(--mut)",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s ease",
        ...style,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
      Reset Layout
    </button>
  );
}
