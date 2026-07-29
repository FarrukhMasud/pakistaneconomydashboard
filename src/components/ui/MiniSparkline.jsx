import { COLORS } from '../../utils/chartConfig';

/**
 * Tiny SVG sparkline for pulse chips / watchlist cards.
 * @param {{ values: number[], color?: string, positiveIsUp?: boolean }} props
 */
export default function MiniSparkline({ values = [], color, className = 'mini-spark' }) {
  const nums = (values || []).filter((v) => Number.isFinite(v));
  if (nums.length < 2) {
    return <svg className={className} viewBox="0 0 100 28" aria-hidden="true" />;
  }

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const w = 100;
  const h = 28;
  const pad = 2;

  const points = nums.map((v, i) => {
    const x = pad + (i / (nums.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const stroke = color || COLORS.teal;
  const last = nums[nums.length - 1];
  const first = nums[0];
  const rising = last >= first;
  const fill = rising ? 'rgba(0, 212, 170, 0.12)' : 'rgba(239, 83, 80, 0.1)';

  const area = `M${points[0]} L${points.join(' L')} L${w - pad},${h - pad} L${pad},${h - pad} Z`;

  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill={fill} stroke="none" />
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points.join(' ')}
      />
    </svg>
  );
}
