/** Apply focus filter to chart.js dataset array (hides non-focused series). */
export function applySeriesFocus(datasets, focus) {
  if (focus == null || !Array.isArray(datasets)) return datasets;
  return datasets.map((ds, index) => ({
    ...ds,
    hidden: index !== focus,
  }));
}
