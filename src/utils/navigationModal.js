const scrollLocks = new WeakMap();

/** Restore the original body style only after the last navigation dialog closes. */
export function lockNavigationScroll(body) {
  let lock = scrollLocks.get(body);
  if (!lock) {
    lock = { count: 0, overflow: body.style.overflow };
    scrollLocks.set(body, lock);
  }
  lock.count += 1;
  body.style.overflow = 'hidden';
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lock.count -= 1;
    if (lock.count === 0) {
      body.style.overflow = lock.overflow;
      scrollLocks.delete(body);
    }
  };
}

export function paletteShortcutAction(event, { open = false, anotherDialogOpen = false } = {}) {
  if (event.defaultPrevented || event.repeat || event.isComposing || anotherDialogOpen) return null;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    return open ? 'close' : 'open';
  }
  const target = event.target;
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
  if (event.key === '/' && !open && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
    return 'open';
  }
  return null;
}
