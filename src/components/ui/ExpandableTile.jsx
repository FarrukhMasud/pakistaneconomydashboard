import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function ExpandableTile({
  title,
  subtitle,
  className,
  style,
  children,
  details,
  modalClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const expandRef = useRef(null);
  const closeRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const priorOverflow = document.body.style.overflow;
    const expandButton = expandRef.current;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }

      if (event.key === 'Tab') {
        const focusable = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = priorOverflow;
      document.removeEventListener('keydown', onKeyDown);
      expandButton?.focus();
    };
  }, [open]);

  return (
    <div className={`expandable-tile ${className || ''}`} style={style}>
      <button
        ref={expandRef}
        className="tile-expand-btn"
        onClick={() => setOpen(true)}
        aria-label={`Expand ${title || 'tile'}`}
        title="Expand tile"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </button>
      {children}
      {open && createPortal(
        <div
          className="chart-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={modalRef}
            className={`tile-modal ${modalClassName}`}
            role="dialog"
            aria-modal="true"
            aria-label={title || 'Expanded tile'}
          >
            <div className="chart-modal__header">
              <div>
                {title && <h2>{title}</h2>}
                {subtitle && <p>{subtitle}</p>}
              </div>
              <button
                ref={closeRef}
                className="chart-modal__close"
                onClick={() => setOpen(false)}
                aria-label="Close expanded tile"
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="tile-modal__body">
              {details || children}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
