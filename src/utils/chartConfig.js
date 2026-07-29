import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

// Register all components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
  Title
);

// Global dark-theme defaults
ChartJS.defaults.color = '#8b8d97';
ChartJS.defaults.borderColor = '#2a2d37';
ChartJS.defaults.font.family = "'Inter', 'IBM Plex Sans', -apple-system, sans-serif";
ChartJS.defaults.font.size = 12;
ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
ChartJS.defaults.plugins.legend.labels.padding = 16;
ChartJS.defaults.plugins.tooltip.backgroundColor = '#1a1d27';
ChartJS.defaults.plugins.tooltip.borderColor = '#2a2d37';
ChartJS.defaults.plugins.tooltip.borderWidth = 1;
ChartJS.defaults.plugins.tooltip.cornerRadius = 10;
ChartJS.defaults.plugins.tooltip.padding = 12;
ChartJS.defaults.plugins.tooltip.titleFont = { weight: '600', family: "'IBM Plex Sans', Inter, sans-serif" };
ChartJS.defaults.elements.point.radius = 2.5;
ChartJS.defaults.elements.point.hoverRadius = 6;
ChartJS.defaults.elements.line.tension = 0.35;
ChartJS.defaults.elements.line.borderWidth = 2.25;

// Honour reduced-motion preferences for chart animations.
const prefersReducedMotion = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
const drawInAnimation = {
  duration: 950,
  easing: 'easeOutQuart',
};
if (prefersReducedMotion) {
  ChartJS.defaults.animation = false;
  ChartJS.defaults.transitions = { active: { animation: { duration: 0 } } };
} else {
  ChartJS.defaults.animation = drawInAnimation;
}

if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const syncMotion = () => {
    ChartJS.defaults.animation = mq.matches ? false : { ...drawInAnimation };
  };
  mq.addEventListener?.('change', syncMotion);
}

// ─── Color Palette ───
export const COLORS = {
  teal: '#00d4aa',
  tealAlpha: 'rgba(0, 212, 170, 0.15)',
  amber: '#ffa726',
  amberAlpha: 'rgba(255, 167, 38, 0.15)',
  coral: '#ef5350',
  coralAlpha: 'rgba(239, 83, 80, 0.15)',
  blue: '#42a5f5',
  blueAlpha: 'rgba(66, 165, 245, 0.15)',
  purple: '#ab47bc',
  purpleAlpha: 'rgba(171, 71, 188, 0.15)',
  grid: '#2a2d37',
  text: '#8b8d97',
  textPrimary: '#e4e6eb',
};

export const COLOR_LIST = [
  COLORS.teal,
  COLORS.amber,
  COLORS.coral,
  COLORS.blue,
  COLORS.purple,
  '#26c6da',   // cyan
  '#66bb6a',   // green
  '#ff7043',   // deep orange
  '#78909c',   // blue grey
  '#ec407a',   // pink
  '#8d6e63',   // brown
  '#5c6bc0',   // indigo
];

// ─── Helpers ───
export function formatCurrency(val) {
  if (val == null) return '—';
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  return `$${val.toLocaleString()}`;
}

export function formatPercent(val) {
  if (val == null) return '—';
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
}

function toRgba(color, alpha) {
  if (!color) return `rgba(0, 212, 170, ${alpha})`;
  if (color.startsWith('rgba')) return color.replace(/rgba\(([^)]+),\s*[\d.]+\)/, `rgba($1, ${alpha})`);
  if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

export function createGradient(ctx, color) {
  const h = ctx.canvas?.clientHeight || 220;
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, toRgba(color, 0.42));
  gradient.addColorStop(0.55, toRgba(color, 0.14));
  gradient.addColorStop(1, toRgba(color, 0));
  return gradient;
}

// ─── Base Chart Options ───
const commonScales = {
  x: {
    grid: { color: COLORS.grid, drawBorder: false },
    ticks: { color: COLORS.text, maxRotation: 45, autoSkipPadding: 8 },
  },
  y: {
    grid: { color: COLORS.grid, drawBorder: false },
    ticks: { color: COLORS.text },
  },
};

export const baseLineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 900,
    easing: 'easeOutQuart',
  },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: true, position: 'top' },
    tooltip: { mode: 'index', intersect: false },
  },
  scales: { ...commonScales },
};

export const baseBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 800,
    easing: 'easeOutQuart',
  },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: true, position: 'top' },
    tooltip: { mode: 'index', intersect: false },
  },
  scales: {
    ...commonScales,
    y: {
      ...commonScales.y,
      beginAtZero: true,
    },
  },
};

export const baseAreaOptions = {
  ...baseLineOptions,
  elements: {
    line: { fill: true },
  },
};

export const baseDoughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    animateRotate: true,
    animateScale: true,
    duration: 900,
    easing: 'easeOutQuart',
  },
  plugins: {
    legend: { display: true, position: 'right' },
    tooltip: { enabled: true },
  },
  cutout: '65%',
};
