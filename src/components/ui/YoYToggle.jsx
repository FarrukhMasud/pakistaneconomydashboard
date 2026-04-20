/**
 * Chart-level toggle for year-over-year comparison overlay.
 * Shows a dashed prior-year line alongside the current data.
 */
export default function YoYToggle({ enabled, onToggle }) {
  return (
    <button
      className={`yoy-toggle ${enabled ? 'yoy-toggle--active' : ''}`}
      onClick={onToggle}
      title={enabled ? 'Hide prior year comparison' : 'Compare with same period last year'}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      {enabled ? 'Hide YoY' : 'Compare YoY'}
    </button>
  );
}
