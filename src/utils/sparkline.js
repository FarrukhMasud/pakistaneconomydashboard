export function sparklineSegments(values = [], { width = 100, height = 28, padding = 2 } = {}) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [];
  const min = Math.min(...finite);
  const span = Math.max(...finite) - min || 1;
  const segments = [];
  let segment = [];
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      if (segment.length) segments.push(segment);
      segment = [];
      return;
    }
    segment.push({
      x: padding + index / Math.max(values.length - 1, 1) * (width - padding * 2),
      y: padding + (1 - (value - min) / span) * (height - padding * 2),
    });
  });
  if (segment.length) segments.push(segment);
  return segments;
}
