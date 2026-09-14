/** Apply focus filter to chart.js dataset array (hides non-focused series). */
export function applySeriesFocus(datasets, focus) {
  if (!Array.isArray(datasets) || !Number.isInteger(focus) || focus < 0 || focus >= datasets.length) return datasets;
  return datasets.map((ds, index) => ({
    ...ds,
    hidden: index !== focus,
  }));
}
