"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKey);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <style>{`
        .modal-overlay {
          position: fixed; inset: 0; z-index: 10000;
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
        role="presentation"
      >
        <div
          className="modal-box"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="modal-head">
            <div id={titleId} className="modal-title">{title}</div>
            <button
              ref={closeButtonRef}
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label={`Close ${title}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div className="modal-body">{children}</div>
        </div>
      </div>
    </>,
    document.body,
  );
}
