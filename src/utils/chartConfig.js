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
ChartJS.defaults.font.family = "'Inter', -apple-system, sans-serif";
ChartJS.defaults.font.size = 12;
ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
ChartJS.defaults.plugins.legend.labels.padding = 16;
ChartJS.defaults.plugins.tooltip.backgroundColor = '#1a1d27';
ChartJS.defaults.plugins.tooltip.borderColor = '#2a2d37';
ChartJS.defaults.plugins.tooltip.borderWidth = 1;
ChartJS.defaults.plugins.tooltip.cornerRadius = 8;
ChartJS.defaults.plugins.tooltip.padding = 10;
ChartJS.defaults.plugins.tooltip.titleFont = { weight: '600' };
ChartJS.defaults.elements.point.radius = 3;
ChartJS.defaults.elements.point.hoverRadius = 6;
ChartJS.defaults.elements.line.tension = 0.3;

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

export function createGradient(ctx, color) {
  const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.clientHeight);
  gradient.addColorStop(0, color.replace(')', ', 0.35)').replace('rgb', 'rgba'));
  gradient.addColorStop(1, color.replace(')', ', 0.0)').replace('rgb', 'rgba'));
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
