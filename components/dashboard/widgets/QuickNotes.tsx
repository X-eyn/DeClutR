"use client";

import Link from "next/link";
import { useState } from "react";
import type { TemporalItemWithRelations } from "@/types";

interface QuickNotesProps {
  items: TemporalItemWithRelations[];
  onComplete?: (id: string) => void;
  onAddItem?: () => void;
}

export default function QuickNotes({ items, onComplete, onAddItem }: QuickNotesProps) {
  const tasks = items
    .filter(i =>
      i.type === "TASK" &&
      i.status !== "COMPLETED" &&
      i.status !== "ARCHIVED" &&
      new Date(i.dueDate).getFullYear() >= 2099
    )
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 4);

  const [done, setDone] = useState<Set<string>>(new Set());

  async function handleCheck(id: string) {
    if (done.has(id)) return;
    setDone(prev => new Set(prev).add(id));
    await onComplete?.(id);
  }

  return (
    <>
      <style>{`
        .qn-card {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 18px; padding: 18px 18px 12px;
          box-shadow: var(--shadow-sm);
        }
        .qn-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .qn-title-wrap { display: flex; align-items: center; gap: 8px; }
        .qn-ico-wrap {
          width: 26px; height: 26px; border-radius: 7px;
          background: var(--indigo-soft); color: var(--indigo);
          display: grid; place-items: center;
        }
        .qn-title { font-size: 15px; font-weight: 700; color: var(--ink); }
        .qn-add {
          width: 28px; height: 28px; border-radius: 8px;
          background: var(--indigo-soft); color: var(--indigo-deep);
          border: 0; cursor: pointer; display: grid; place-items: center;
        }
        .qn-add:hover { background: var(--indigo-soft-2); }
        .qn-row { display: flex; align-items: center; gap: 11px; padding: 9px 0; }
        .qn-check {
          width: 18px; height: 18px; border-radius: 6px;
          border: 1.5px solid #d1d5db; flex-shrink: 0;
          display: grid; place-items: center; cursor: pointer;
          transition: all .15s; background: white;
        }
        .qn-check:hover { border-color: var(--indigo); background: var(--indigo-soft); }
        .qn-check.checked { background: var(--indigo); border-color: var(--indigo); }
        .qn-text { font-size: 13.5px; color: var(--ink-2); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .qn-text.done { color: var(--mut-2); text-decoration: line-through; }
        .qn-empty { text-align: center; padding: 16px 0; color: var(--mut); font-size: 12.5px; }
        .qn-view-all {
          display: block; text-align: right; padding-right: 2px;
          color: var(--indigo); font-weight: 600; font-size: 13px;
          padding: 8px 2px 2px; cursor: pointer; text-decoration: none;
        }
      `}</style>
      <div className="qn-card">
        <div className="qn-head">
          <div className="qn-title-wrap">
            <div className="qn-ico-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                <path d="M14 3v6h6"/>
              </svg>
            </div>
            <span className="qn-title">Quick Notes</span>
          </div>
          <button className="qn-add" onClick={onAddItem}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="qn-empty">No notes yet.</div>
        ) : (
          tasks.map(item => {
            const isDone = done.has(item.id);
            return (
              <div key={item.id} className="qn-row">
                <div
                  className={`qn-check${isDone ? " checked" : ""}`}
                  onClick={() => handleCheck(item.id)}
                >
                  {isDone && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
                <div className={`qn-text${isDone ? " done" : ""}`}>{item.title}</div>
              </div>
            );
          })
        )}

        <Link className="qn-view-all" href="/dashboard/notes">View all notes →</Link>
      </div>
    </>
  );
}
