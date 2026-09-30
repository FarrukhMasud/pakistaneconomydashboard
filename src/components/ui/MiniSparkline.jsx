import { COLORS } from '../../utils/chartConfig';
import { sparklineSegments } from '../../utils/sparkline';

/**
 * Tiny SVG sparkline for pulse chips / watchlist cards.
 * @param {{ values: number[], color?: string, positiveIsUp?: boolean }} props
 */
export default function MiniSparkline({ values = [], color, className = 'mini-spark' }) {
  const nums = (values || []).filter((v) => Number.isFinite(v));
  if (nums.length < 2) {
    return <svg className={className} viewBox="0 0 100 28" aria-hidden="true" />;
  }

  const w = 100;
  const h = 28;
  const pad = 2;
  const segments = sparklineSegments(values);

  const stroke = color || COLORS.teal;
  const last = nums[nums.length - 1];
  const first = nums[0];
  const rising = last >= first;
  const fill = rising ? 'rgba(0, 212, 170, 0.12)' : 'rgba(239, 83, 80, 0.1)';

  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {segments.map((segment, index) => {
        if (segment.length === 1) return <circle key={index} cx={segment[0].x} cy={segment[0].y} r="1" fill={stroke} />;
        const points = segment.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`);
        const area = `M${points[0]} L${points.join(' L')} L${segment.at(-1).x},${h - pad} L${segment[0].x},${h - pad} Z`;
        return <g key={index}><path d={area} fill={fill} stroke="none" /><polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points.join(' ')}
        /></g>;
      })}
    </svg>
  );
}
