import { useState, useEffect } from 'react';
import { Chart as ChartJS } from 'chart.js';
import './App.css';
import './utils/chartConfig';
import { useTheme } from './hooks/useTheme';
import ThemeToggle from './components/ThemeToggle';
import KpiCards from './components/KpiCards';
import TradeSection from './components/TradeSection';
import ReservesSection from './components/ReservesSection';
import ExchangeRateSection from './components/ExchangeRateSection';
import RemittancesSection from './components/RemittancesSection';
import FdiSection from './components/FdiSection';
import ServicesSection from './components/ServicesSection';
import FiscalSection from './components/FiscalSection';
import InflationSection from './components/InflationSection';
import MonetarySection from './components/MonetarySection';

const TABS = [
  { id: 'overview', label: '📊 Overview' },
  { id: 'trade', label: '🚢 Trade' },
  { id: 'reserves', label: '🏦 Reserves' },
  { id: 'exchange', label: '💱 Exchange Rate' },
  { id: 'remittances', label: '💸 Remittances' },
  { id: 'fdi', label: '💰 FDI' },
  { id: 'services', label: '💻 IT & Services' },
  { id: 'inflation', label: '📈 Inflation' },
  { id: 'monetary', label: '🏛️ Monetary' },
  { id: 'fiscal', label: '📋 Fiscal' },
];

const SECTION_MAP = {
  overview: KpiCards,
  trade: TradeSection,
  reserves: ReservesSection,
  exchange: ExchangeRateSection,
  remittances: RemittancesSection,
  fdi: FdiSection,
  services: ServicesSection,
  inflation: InflationSection,
  monetary: MonetarySection,
  fiscal: FiscalSection,
};

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const { theme, setTheme } = useTheme();
  const ActiveSection = SECTION_MAP[activeTab];

  // Update Chart.js defaults when theme changes
  useEffect(() => {
    const update = () => {
      const style = getComputedStyle(document.documentElement);
      ChartJS.defaults.color = style.getPropertyValue('--text-secondary').trim() || '#8b8d97';
      ChartJS.defaults.borderColor = style.getPropertyValue('--border-color').trim() || '#2a2d37';

      const bgCard = style.getPropertyValue('--bg-card').trim() || '#1a1d27';
      const borderColor = style.getPropertyValue('--border-color').trim() || '#2a2d37';
      const textPrimary = style.getPropertyValue('--text-primary').trim() || '#e4e6eb';
      const textSecondary = style.getPropertyValue('--text-secondary').trim() || '#8b8d97';

      ChartJS.defaults.plugins.tooltip.backgroundColor = bgCard;
      ChartJS.defaults.plugins.tooltip.borderColor = borderColor;
      ChartJS.defaults.plugins.tooltip.titleColor = textPrimary;
      ChartJS.defaults.plugins.tooltip.bodyColor = textSecondary;
    };
    // Small delay so CSS variables are applied first
    const timer = setTimeout(update, 50);
    return () => clearTimeout(timer);
  }, [theme]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="flag-accent" />
        <div className="header-content">
          <div className="header-top-row">
            <div />
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
          <div className="header-emblem">☪</div>
          <h1>Pakistan <span className="highlight">Economic Dashboard</span></h1>
          <p className="subtitle">
            Official data from SBP, PBS &amp; Ministry of Finance
          </p>
        </div>
      </header>

      <nav className="tab-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="dashboard-content">
        <div className="fade-in" key={`${activeTab}-${theme}`}>
          <ActiveSection />
        </div>
      </main>

      <footer className="app-footer">
        <p>Pakistan Economic Dashboard &mdash; Built with open data</p>
        <div className="footer-sources">
          <a href="https://www.sbp.org.pk" target="_blank" rel="noreferrer">
            State Bank of Pakistan
          </a>
          <a href="https://www.pbs.gov.pk" target="_blank" rel="noreferrer">
            Pakistan Bureau of Statistics
          </a>
          <a href="https://www.finance.gov.pk" target="_blank" rel="noreferrer">
            Ministry of Finance
          </a>
          <a href="https://invest.gov.pk" target="_blank" rel="noreferrer">
            Board of Investment
          </a>
          <a href="https://pseb.org.pk" target="_blank" rel="noreferrer">
            PSEB
          </a>
          <a href="https://www.imf.org/en/Countries/PAK" target="_blank" rel="noreferrer">
            IMF Pakistan
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App;
