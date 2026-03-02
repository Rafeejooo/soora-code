import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Modern custom dropdown select component.
 * @param {{ value: string, onChange: (val: string) => void, options: { value: string, label: string }[], className?: string, placeholder?: string }} props
 */
export default function CustomSelect({ value, onChange, options, className = '', placeholder = 'Select...' }) {
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const ref = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Reset focused index when opening
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setFocusedIdx(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  // Scroll focused item into view
  useEffect(() => {
    if (!open || focusedIdx < 0 || !listRef.current) return;
    const el = listRef.current.children[focusedIdx];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx, open]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else if (focusedIdx >= 0 && focusedIdx < options.length) {
        onChange(options[focusedIdx].value);
        setOpen(false);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setFocusedIdx((i) => Math.min(i + 1, options.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setFocusedIdx((i) => Math.max(i - 1, 0));
    }
  }, [open, focusedIdx, options, onChange]);

  return (
    <div
      className={`cs-wrap ${className} ${open ? 'cs-open' : ''}`}
      ref={ref}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="listbox"
      aria-expanded={open}
    >
      <button
        className="cs-trigger"
        onClick={() => setOpen(!open)}
        type="button"
        aria-haspopup="listbox"
      >
        <span className="cs-value">{selected?.label || placeholder}</span>
        <svg className="cs-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div className="cs-dropdown" ref={listRef}>
          {options.map((opt, i) => (
            <button
              key={opt.value}
              className={`cs-option ${opt.value === value ? 'cs-active' : ''} ${i === focusedIdx ? 'cs-focused' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              type="button"
              role="option"
              aria-selected={opt.value === value}
            >
              <span>{opt.label}</span>
              {opt.value === value && (
                <svg className="cs-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
