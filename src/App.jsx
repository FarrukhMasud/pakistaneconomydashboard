import { useState, useEffect, useMemo } from 'react';
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
import CountryTrendsSection from './components/CountryTrendsSection';
import FiscalSection from './components/FiscalSection';
import FbrTaxSection from './components/FbrTaxSection';
import InflationSection from './components/InflationSection';
import MonetarySection from './components/MonetarySection';
import FederalBudgetSection from './components/FederalBudgetSection';
import ProvincialBudgetSection from './components/ProvincialBudgetSection';
import FeedbackSection from './components/FeedbackSection';
import {
  EconomicBriefingSection,
  EconomicTimelineSection,
  LearningCenterSection,
  PeerComparisonSection,
  RiskOutlookSection,
  SourceTrustSection,
} from './components/InsightsSections';

const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    icon: '📊',
    blurb: 'State of the economy at a glance',
    sections: [
      { id: 'overview', label: 'State of the Economy', component: KpiCards },
    ],
  },
  {
    id: 'external',
    label: 'External Sector',
    icon: '🌍',
    blurb: 'Trade, reserves, flows & the rupee',
    sections: [
      { id: 'trade', label: '🚢 Trade', component: TradeSection },
      { id: 'country-trends', label: '🌐 Country Trends', component: CountryTrendsSection },
      { id: 'reserves', label: '🏦 Reserves', component: ReservesSection },
      { id: 'exchange', label: '💱 Exchange Rate', component: ExchangeRateSection },
      { id: 'remittances', label: '💸 Remittances', component: RemittancesSection },
      { id: 'fdi', label: '💰 FDI', component: FdiSection },
      { id: 'services', label: '💻 IT & Services', component: ServicesSection },
    ],
  },
  {
    id: 'prices',
    label: 'Prices & Money',
    icon: '📈',
    blurb: 'Inflation and the monetary sector',
    sections: [
      { id: 'inflation', label: '📈 Inflation', component: InflationSection },
      { id: 'monetary', label: '🏛️ Monetary', component: MonetarySection },
    ],
  },
  {
    id: 'fiscal',
    label: 'Public Finance & Budget',
    icon: '🧾',
    blurb: 'Revenue, deficits, federal & provincial budgets',
    sections: [
      { id: 'fiscal', label: '📋 Fiscal & GDP', component: FiscalSection },
      { id: 'fbr', label: '🧾 FBR Tax', component: FbrTaxSection },
      { id: 'federal-budget', label: '🏛️ Federal Budget', component: FederalBudgetSection },
      { id: 'provincial-budget', label: '🗺️ Provincial Budgets', component: ProvincialBudgetSection },
    ],
  },
  {
    id: 'insights',
    label: 'Insights & Learning',
    icon: '🎓',
    blurb: 'Explain, compare, contextualize',
    sections: [
      { id: 'briefing', label: '🧭 Briefing', component: EconomicBriefingSection },
      { id: 'risk-outlook', label: '⚠️ Risk & Outlook', component: RiskOutlookSection },
      { id: 'peers', label: '🌏 Peer Comparison', component: PeerComparisonSection },
      { id: 'timeline', label: '🕰️ Timeline', component: EconomicTimelineSection },
      { id: 'learning', label: '🎓 Learning Center', component: LearningCenterSection },
      { id: 'source-trust', label: '✅ Source Trust', component: SourceTrustSection },
      { id: 'feedback', label: '✉️ Feedback', component: FeedbackSection },
    ],
  },
];

function App() {
  const [activeGroupId, setActiveGroupId] = useState('overview');
  const [activeSectionId, setActiveSectionId] = useState('overview');
  const { theme, setTheme } = useTheme();

  const activeGroup = useMemo(
    () => NAV_GROUPS.find((g) => g.id === activeGroupId) || NAV_GROUPS[0],
    [activeGroupId],
  );
  const activeSection = useMemo(
    () => activeGroup.sections.find((s) => s.id === activeSectionId) || activeGroup.sections[0],
    [activeGroup, activeSectionId],
  );
  const ActiveSection = activeSection.component;
  const showSubNav = activeGroup.sections.length > 1;

  const selectGroup = (group) => {
    setActiveGroupId(group.id);
    setActiveSectionId(group.sections[0].id);
  };

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
            Authentic, officially-sourced data from SBP, PBS, FBR &amp; the Finance Division
          </p>
        </div>
      </header>

      <nav className="group-nav" aria-label="Primary">
        {NAV_GROUPS.map((group) => (
          <button
            key={group.id}
            className={`group-btn ${activeGroupId === group.id ? 'active' : ''}`}
            onClick={() => selectGroup(group)}
            aria-current={activeGroupId === group.id ? 'page' : undefined}
          >
            <span className="group-btn__icon">{group.icon}</span>
            <span className="group-btn__text">
              <span className="group-btn__label">{group.label}</span>
              <span className="group-btn__blurb">{group.blurb}</span>
            </span>
          </button>
        ))}
      </nav>

      {showSubNav && (
        <nav className="sub-nav" aria-label={activeGroup.label}>
          {activeGroup.sections.map((section) => (
            <button
              key={section.id}
              className={`sub-tab-btn ${activeSectionId === section.id ? 'active' : ''}`}
              onClick={() => setActiveSectionId(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>
      )}

      <main className="dashboard-content">
        <div className="fade-in" key={`${activeSectionId}-${theme}`}>
          <ActiveSection />
        </div>
      </main>

      <footer className="app-footer">
        <p>Pakistan Economic Dashboard &mdash; Built with authentic open government data</p>
        <div className="footer-sources">
          <button
            type="button"
            className="footer-feedback-link"
            onClick={() => {
              setActiveGroupId('insights');
              setActiveSectionId('feedback');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Send feedback
          </button>
          <a href="https://www.sbp.org.pk" target="_blank" rel="noreferrer">State Bank of Pakistan</a>
          <a href="https://www.pbs.gov.pk" target="_blank" rel="noreferrer">Pakistan Bureau of Statistics</a>
          <a href="https://www.finance.gov.pk" target="_blank" rel="noreferrer">Ministry of Finance</a>
          <a href="https://www.fbr.gov.pk" target="_blank" rel="noreferrer">Federal Board of Revenue</a>
          <a href="https://invest.gov.pk" target="_blank" rel="noreferrer">Board of Investment</a>
          <a href="https://www.imf.org/en/Countries/PAK" target="_blank" rel="noreferrer">IMF Pakistan</a>
        </div>
      </footer>
    </div>
  );
}

export default App;
