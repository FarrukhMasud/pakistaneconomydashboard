import { useEffect, useRef } from 'react';

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

function formatNumber(value, decimals, prefix, suffix) {
  if (value == null || !Number.isFinite(value)) return `${prefix}—${suffix}`;
  return `${prefix}${value.toFixed(decimals)}${suffix}`;
}

/**
 * Count-up number for KPI values. Falls back instantly under reduced motion.
 * Updates the DOM directly during the animation to avoid render thrash.
 */
export default function AnimatedNumber({
  value,
  decimals = 0,
  duration = 700,
  className,
  style,
  suffix = '',
  prefix = '',
}) {
  const target = Number.isFinite(value) ? value : null;
  const nodeRef = useRef(null);
  const fromRef = useRef(target);

  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return undefined;

    if (target == null || prefersReducedMotion() || fromRef.current == null) {
      fromRef.current = target;
      el.textContent = formatNumber(target, decimals, prefix, suffix);
      return undefined;
    }

    const from = fromRef.current;
    const delta = target - from;
    const start = performance.now();
    let frame = 0;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      el.textContent = formatNumber(from + delta * eased, decimals, prefix, suffix);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, decimals, prefix, suffix]);

  return (
    <span ref={nodeRef} className={className} style={style}>
      {formatNumber(target, decimals, prefix, suffix)}
    </span>
  );
}
