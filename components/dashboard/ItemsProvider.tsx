"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CreateItemInput, TemporalItemWithRelations, UpdateItemInput } from "@/types";

type ItemStatus = NonNullable<UpdateItemInput["status"]>;

interface ItemsContextValue {
  items: TemporalItemWithRelations[];
  loading: boolean;
  error: string | null;
  refreshItems: () => Promise<void>;
  createItem: (data: CreateItemInput) => Promise<TemporalItemWithRelations | null>;
  updateItem: (id: string, data: UpdateItemInput) => Promise<TemporalItemWithRelations | null>;
  deleteItem: (id: string) => Promise<void>;
  completeItem: (id: string) => Promise<TemporalItemWithRelations | null>;
  uncompleteItem: (id: string) => Promise<TemporalItemWithRelations | null>;
  dismissItem: (id: string) => Promise<TemporalItemWithRelations | null>;
}

const ItemsContext = createContext<ItemsContextValue | null>(null);

function parseItems(data: unknown): TemporalItemWithRelations[] {
  if (Array.isArray(data)) return data as TemporalItemWithRelations[];
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: TemporalItemWithRelations[] }).items;
  }
  return [];
}

function replaceItem(
  list: TemporalItemWithRelations[],
  id: string,
  item: TemporalItemWithRelations
) {
  return list.map((current) => (current.id === id ? item : current));
}

function mergeItemPatch(
  item: TemporalItemWithRelations,
  patch: UpdateItemInput
): TemporalItemWithRelations {
  return {
    ...item,
    ...patch,
    tags: patch.tags
      ? patch.tags.map((name, index) => ({
          id: `${item.id}-tag-${index}-${name}`,
          name,
          color: "#6366f1",
        }))
      : item.tags,
    updatedAt: new Date(),
  } as TemporalItemWithRelations;
}

function makeOptimisticItem(data: CreateItemInput): TemporalItemWithRelations {
  const now = new Date();
  const id = `optimistic-${now.getTime()}`;

  return {
    id,
    userId: "optimistic",
    title: data.title,
    description: data.description ?? null,
    type: data.type,
    priority: data.priority ?? "MEDIUM",
    status: "ACTIVE",
    dueDate: new Date(data.dueDate),
    startDate: data.startDate ? new Date(data.startDate) : null,
    allDay: data.allDay ?? false,
    rrule: null,
    googleCalendarEventId: null,
    googleTaskId: null,
    lastSyncedAt: null,
    reminderMinutes: data.reminderMinutes ?? [],
    tags: (data.tags ?? []).map((name, index) => ({
      id: `${id}-tag-${index}-${name}`,
      name,
      color: "#6366f1",
    })),
    checklists: [],
    createdAt: now,
    updatedAt: now,
  } as TemporalItemWithRelations;
}

async function readItemResponse(res: Response) {
  const json = await res.json().catch(() => null);
  return json && typeof json === "object" && "item" in json
    ? (json as { item?: TemporalItemWithRelations }).item ?? null
    : null;
}

export function ItemsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<TemporalItemWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef<TemporalItemWithRelations[]>([]);
  const fetchedRef = useRef(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const refreshItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/items?limit=500");
      if (!res.ok) throw new Error("Failed to load items");
      const data = await res.json();
      setItems(parseItems(data));
      fetchedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    queueMicrotask(() => void refreshItems());
  }, [refreshItems]);

  const updateItem = useCallback(async (id: string, data: UpdateItemInput) => {
    const previous = itemsRef.current;
    const existing = previous.find((item) => item.id === id);
    if (existing) {
      setItems((current) => replaceItem(current, id, mergeItemPatch(existing, data)));
    }

    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update item");
      const item = await readItemResponse(res);
      if (item) setItems((current) => replaceItem(current, id, item));
      return item;
    } catch (err) {
      setItems(previous);
      throw err;
    }
  }, []);

  const createItem = useCallback(async (data: CreateItemInput) => {
    const optimisticItem = makeOptimisticItem(data);
    const previous = itemsRef.current;
    setItems((current) => [optimisticItem, ...current]);

    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create item");
      const item = await readItemResponse(res);
      if (item) {
        setItems((current) => replaceItem(current, optimisticItem.id, item));
      }
      return item;
    } catch (err) {
      setItems(previous);
      throw err;
    }
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    const previous = itemsRef.current;
    setItems((current) => current.filter((item) => item.id !== id));

    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete item");
    } catch (err) {
      setItems(previous);
      throw err;
    }
  }, []);

  const setStatus = useCallback(
    (id: string, status: ItemStatus) => updateItem(id, { status }),
    [updateItem]
  );

  const value = useMemo<ItemsContextValue>(() => ({
    items,
    loading,
    error,
    refreshItems,
    createItem,
    updateItem,
    deleteItem,
    completeItem: (id) => setStatus(id, "COMPLETED"),
    uncompleteItem: (id) => setStatus(id, "ACTIVE"),
    dismissItem: (id) => setStatus(id, "ARCHIVED"),
  }), [createItem, deleteItem, error, items, loading, refreshItems, setStatus, updateItem]);

  return <ItemsContext.Provider value={value}>{children}</ItemsContext.Provider>;
}

export function useItems() {
  const context = useContext(ItemsContext);
  if (!context) throw new Error("useItems must be used within ItemsProvider");
  return context;
}
