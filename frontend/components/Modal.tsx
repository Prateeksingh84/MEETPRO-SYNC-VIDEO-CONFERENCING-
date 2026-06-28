"use client";

import { ReactNode } from "react";

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="modal-card">
        <div className="modal-header">
          <h2>{title}</h2>

          <button type="button" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {children}
      </section>
    </div>
  );
}
