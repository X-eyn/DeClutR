"use client";

import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <style>{`
        .modal-overlay {
          position: fixed; inset: 0; z-index: 50;
          display: flex; align-items: center; justify-content: center;
          background: rgba(15,23,42,.35); backdrop-filter: blur(4px);
          padding: 16px;
        }
        .modal-box {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 20px; box-shadow: 0 24px 64px rgba(15,23,42,.12);
          width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto;
        }
        .modal-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 22px 16px;
          border-bottom: 1px solid var(--line);
          position: sticky; top: 0; background: var(--panel); z-index: 1;
          border-radius: 20px 20px 0 0;
        }
        .modal-title { font-size: 15px; font-weight: 700; color: var(--ink); }
        .modal-close {
          padding: 5px; border-radius: 8px; border: none; background: none;
          cursor: pointer; color: var(--mut); display: grid; place-items: center;
          transition: all .12s;
        }
        .modal-close:hover { background: var(--line-2); color: var(--ink); }
        .modal-body { padding: 20px 22px 24px; }
      `}</style>
      <div
        ref={overlayRef}
        className="modal-overlay"
        onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      >
        <div className="modal-box">
          <div className="modal-head">
            <div className="modal-title">{title}</div>
            <button className="modal-close" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div className="modal-body">{children}</div>
        </div>
      </div>
    </>
  );
}
