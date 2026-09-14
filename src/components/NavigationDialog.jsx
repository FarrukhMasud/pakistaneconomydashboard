import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import useI18n from '../i18n/useI18n';
import { lockNavigationScroll } from '../utils/navigationModal';

/** Native modal dialogs provide an inert background and a browser focus trap. */
export default function NavigationDialog({ title, description, onClose, children, className = '' }) {
  const { t } = useI18n();
  const id = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog.showModal();
    const releaseScrollLock = lockNavigationScroll(document.body);
    (dialog.querySelector('[data-initial-focus]') || dialog.querySelector('button'))?.focus();
    return () => {
      dialog.close();
      releaseScrollLock();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`navigation-dialog ${className}`}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(event) => { event.preventDefault(); onCloseRef.current(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right
          || event.clientY < rect.top || event.clientY > rect.bottom) onCloseRef.current();
      }}
    >
      <header className="navigation-dialog__header">
        <h2 id={`${id}-title`}>{title}</h2>
        <button type="button" className="navigation-dialog__close" onClick={onClose}>
          {t('common.close', 'Close')}
        </button>
      </header>
      {description && <p id={`${id}-description`} className="navigation-dialog__description">{description}</p>}
      {children}
    </dialog>,
    document.body,
  );
}
