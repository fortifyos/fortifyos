import React from 'react';

export default function Modal({ open, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-md border border-zinc-800 bg-black p-6">
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">{title}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
