import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Chart as ChartJS } from 'chart.js';
import './App.css';
import './utils/chartConfig';
import { useTheme } from './hooks/useTheme';
import { useHashRoute } from './hooks/useHashRoute';
import { useDensity } from './hooks/useDensity';
import ThemeToggle from './components/ThemeToggle';
import LanguageToggle from './components/LanguageToggle';
import DensityToggle from './components/DensityToggle';
import CommandPalette from './components/CommandPalette';
import CoachMarks from './components/CoachMarks';
import { useI18n } from './i18n/useI18n';
import ShareSectionLink from './components/ShareSectionLink';
import KpiCards from './components/KpiCards';
import ReleaseCalendarSection from './components/ReleaseCalendarSection';
import ErrorBoundary from './components/ErrorBoundary';
import ConsentBanner from './components/ConsentBanner';
import UpdateToast from './components/UpdateToast';
import NotFoundSection from './components/NotFoundSection';
import { isCoachPending, isConsentPending } from './utils/startupState';

const TradeSection = lazy(() => import('./components/TradeSection'));
const ReservesSection = lazy(() => import('./components/ReservesSection'));
const ExchangeRateSection = lazy(() => import('./components/ExchangeRateSection'));
const RemittancesSection = lazy(() => import('./components/RemittancesSection'));
const FdiSection = lazy(() => import('./components/FdiSection'));
const ServicesSection = lazy(() => import('./components/ServicesSection'));
const CountryTrendsSection = lazy(() => import('./components/CountryTrendsSection'));
const FiscalSection = lazy(() => import('./components/FiscalSection'));
const FbrTaxSection = lazy(() => import('./components/FbrTaxSection'));
const InflationSection = lazy(() => import('./components/InflationSection'));
const MonetarySection = lazy(() => import('./components/MonetarySection'));
const FederalBudgetSection = lazy(() => import('./components/FederalBudgetSection'));
const ProvincialBudgetSection = lazy(() => import('./components/ProvincialBudgetSection'));
const FeedbackSection = lazy(() => import('./components/FeedbackSection'));
const DataApiSection = lazy(() => import('./components/DataApiSection'));

// Insight sections share helpers; split into briefing vs deep-dive chunks.
const briefingModule = () => import('./components/insights/BriefingBundle.jsx');
const deepModule = () => import('./components/insights/DeepDiveBundle.jsx');
const briefing = (name) => lazy(() => briefingModule().then((m) => ({ default: m[name] })));
const deep = (name) => lazy(() => deepModule().then((m) => ({ default: m[name] })));

const EconomicBriefingSection = briefing('EconomicBriefingSection');
const GoodBadWatchSection = briefing('GoodBadWatchSection');
const LearningCenterSection = briefing('LearningCenterSection');
const SourceTrustSection = briefing('SourceTrustSection');
const EconomicTimelineSection = briefing('EconomicTimelineSection');
const RiskOutlookSection = briefing('RiskOutlookSection');

const ExternalFinancingWallSection = deep('ExternalFinancingWallSection');
const ImfComplianceSection = deep('ImfComplianceSection');
const ItExportDeepDiveSection = deep('ItExportDeepDiveSection');
const MacroRiskScorecardSection = deep('MacroRiskScorecardSection');
const PeerComparisonSection = deep('PeerComparisonSection');
const RevenueTargetMeterSection = deep('RevenueTargetMeterSection');

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
      { id: 'macro-risk', label: '🚦 Macro Risk', component: MacroRiskScorecardSection },
      { id: 'good-bad-watch', label: '🧾 Good / Bad / Watch', component: GoodBadWatchSection },
      { id: 'imf-compliance', label: '🏛️ IMF Compliance', component: ImfComplianceSection },
      { id: 'financing-wall', label: '🌐 Financing Wall', component: ExternalFinancingWallSection },
      { id: 'revenue-meter', label: '🎯 Revenue Meter', component: RevenueTargetMeterSection },
      { id: 'it-deep-dive', label: '💻 IT Deep Dive', component: ItExportDeepDiveSection },
      { id: 'risk-outlook', label: '⚠️ Risk & Outlook', component: RiskOutlookSection },
      { id: 'peers', label: '🌏 Peer Comparison', component: PeerComparisonSection },
      { id: 'timeline', label: '🕰️ Timeline', component: EconomicTimelineSection },
      { id: 'learning', label: '🎓 Learning Center', component: LearningCenterSection },
      { id: 'source-trust', label: '✅ Source Trust', component: SourceTrustSection },
      { id: 'release-calendar', label: '📅 Release Calendar', component: ReleaseCalendarSection },
      { id: 'data-api', label: '⬇️ Data & API', component: DataApiSection },
      { id: 'feedback', label: '✉️ Feedback', component: FeedbackSection },
    ],
  },
];

function App() {
  const {
    groupId: activeGroupId,
    sectionId: activeSectionId,
    known: routeKnown,
    navigate,
    path: routePath,
  } = useHashRoute(NAV_GROUPS);
  const { theme, setTheme } = useTheme();
  const { density } = useDensity();
  const { t, tx, lang } = useI18n();
  const [consentPending, setConsentPending] = useState(isConsentPending);
  const [coachPending, setCoachPending] = useState(isCoachPending);

  const groupLabel = (group) => t(`nav.group.${group.id}`, group.label);
  const groupBlurb = (group) => t(`nav.group.${group.id}.blurb`, group.blurb);
  const sectionLabel = (section) => t(`nav.section.${section.id}`, section.label);

  const activeGroup = useMemo(
    () => NAV_GROUPS.find((g) => g.id === activeGroupId) || NAV_GROUPS[0],
    [activeGroupId],
  );
  const activeSection = useMemo(
    () => activeGroup.sections.find((s) => s.id === activeSectionId) || activeGroup.sections[0],
    [activeGroup, activeSectionId],
  );
  const ActiveSection = routeKnown ? activeSection.component : NotFoundSection;
  const showSubNav = routeKnown && activeGroup.sections.length > 1;

  // Announce section changes to screen readers: hash routing swaps the whole
  // <main> without a page load, which is otherwise silent for assistive tech.
  // Derived during render so the live region only fires on an actual change.
  const routeAnnouncement = t('a11y.sectionAnnounce', 'Now showing {name}')
    .replace('{name}', t(`nav.section.${activeSection.id}`, activeSection.label).replace(/^\P{L}+/u, ''));

  // Keep the document title in sync so browser history and shared links are
  // self-describing rather than all reading "Pakistan Economic Dashboard".
  useEffect(() => {
    const label = t(`nav.section.${activeSection.id}`, activeSection.label);
    document.title = `${label.replace(/^\P{L}+/u, '')} · ${t('app.title')} ${t('app.titleHighlight')}`;
  }, [activeSection, t, lang]);

  // Update Chart.js defaults when theme changes (no section remount required).
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
      update();
      // One rAF so CSS variables from data-theme are applied first.
      const id = requestAnimationFrame(update);
      return () => cancelAnimationFrame(id);
    }, [theme]);

  return (
    <div className="app" data-section-group={activeGroupId} data-density={density}>
      <a className="skip-link" href="#main-content">{t('a11y.skipToContent', 'Skip to main content')}</a>

      <div className="app-chrome">
        <div className="chrome-bar">
          <button
            type="button"
            className="chrome-brand"
            onClick={() => navigate('overview', 'overview')}
            aria-label={t('app.home', 'Home — overview')}
          >
            <span className="chrome-brand__mark" aria-hidden="true">☪</span>
            <span className="chrome-brand__text">
              <span className="chrome-brand__title">
                {t('app.title')} {t('app.titleHighlight')}
              </span>
              <span className="chrome-brand__sub">{t('app.chromeTag', 'Official-source terminal')}</span>
            </span>
          </button>
          <div className="chrome-actions">
            <a className="header-feedback-link" href="mailto:feedback@economyofpakistan.com">
              {t('app.feedback')}
            </a>
            <CommandPalette
              groups={NAV_GROUPS}
              onNavigate={navigate}
              groupLabel={groupLabel}
              sectionLabel={sectionLabel}
            />
            <DensityToggle />
            <LanguageToggle />
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        </div>

        <nav className="group-nav" aria-label={t('app.primaryNav')}>
          {NAV_GROUPS.map((group) => (
            <button
              key={group.id}
              className={`group-btn ${activeGroupId === group.id ? 'active' : ''}`}
              onClick={() => navigate(group.id, group.sections[0].id)}
              aria-current={activeGroupId === group.id ? 'page' : undefined}
            >
              <span className="group-btn__icon">{group.icon}</span>
              <span className="group-btn__text">
                <span className="group-btn__label">{groupLabel(group)}</span>
                <span className="group-btn__blurb">{groupBlurb(group)}</span>
              </span>
            </button>
          ))}
        </nav>

        <label className="mobile-group-nav">
          <span className="sr-only">{t('app.primaryNav')}</span>
          <select
            value={activeGroupId}
            aria-label={t('app.primaryNav')}
            onChange={(event) => {
              const group = NAV_GROUPS.find((item) => item.id === event.target.value);
              if (group) navigate(group.id, group.sections[0].id);
            }}
          >
            {NAV_GROUPS.map((group) => (
              <option key={group.id} value={group.id}>
                {group.icon} {groupLabel(group)}
              </option>
            ))}
          </select>
        </label>

        {showSubNav && (
          <nav className="sub-nav" aria-label={groupLabel(activeGroup)}>
            {activeGroup.sections.map((section) => (
              <a
                key={section.id}
                href={`/${activeGroup.id}/${section.id}`}
                className={`sub-tab-btn ${activeSectionId === section.id ? 'active' : ''}`}
                aria-current={activeSectionId === section.id ? 'page' : undefined}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                  event.preventDefault();
                  navigate(activeGroup.id, section.id);
                }}
              >
                {sectionLabel(section)}
              </a>
            ))}
          </nav>
        )}
      </div>

      <main className="dashboard-content" id="main-content" tabIndex={-1}>
        <p className="sr-only" role="status" aria-live="polite">{routeAnnouncement}</p>
        <div className="section-toolbar">
          <span className="section-breadcrumb">
            {activeGroup.icon} {groupLabel(activeGroup)} <span aria-hidden="true">›</span> {sectionLabel(activeSection)}
          </span>
          <ShareSectionLink groupId={activeGroup.id} sectionId={activeSection.id} label={sectionLabel(activeSection)} />
        </div>
        {lang !== 'en' && <p className="translation-notice">{t('app.translationNotice')}</p>}
        <div className="fade-in" key={routeKnown ? activeSectionId : `missing:${routePath}`}>
          <ErrorBoundary
            resetKey={routeKnown ? activeSectionId : routePath}
            title={t('common.sectionError', 'Something went wrong in this section')}
            retryLabel={t('common.retry', 'Try again')}
          >
            <Suspense
              fallback={(
                <div className="card loading-card">
                  <div className="skeleton-lines" aria-hidden="true">
                    <div className="skeleton-line skeleton-line--lg" />
                    <div className="skeleton-line skeleton-line--md" />
                    <div className="skeleton-line skeleton-line--sm" />
                  </div>
                  <span>{t('common.loading', 'Loading…')}</span>
                </div>
              )}
            >
              {routeKnown ? (
                <ActiveSection />
              ) : (
                <NotFoundSection
                  path={routePath}
                  onGoHome={() => navigate('overview', 'overview')}
                />
              )}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      <UpdateToast blocked={consentPending || coachPending} />
      <ConsentBanner onResolved={() => setConsentPending(false)} />
      <CoachMarks enabled={!consentPending} onFinished={() => setCoachPending(false)} />

      <footer className="app-footer">
        <p>{t('app.footer')}</p>
        <div className="footer-sources">
          <button
            type="button"
            className="footer-feedback-link"
            onClick={() => navigate('insights', 'feedback')}
          >
            {t('app.footerFeedback')}
          </button>
          <a href="https://www.sbp.org.pk" target="_blank" rel="noreferrer">{tx('State Bank of Pakistan')}</a>
          <a href="https://www.pbs.gov.pk" target="_blank" rel="noreferrer">{tx('Pakistan Bureau of Statistics')}</a>
          <a href="https://www.finance.gov.pk" target="_blank" rel="noreferrer">{tx('Ministry of Finance')}</a>
          <a href="https://www.fbr.gov.pk" target="_blank" rel="noreferrer">{tx('Federal Board of Revenue')}</a>
          <a href="https://invest.gov.pk" target="_blank" rel="noreferrer">{tx('Board of Investment')}</a>
          <a href="https://www.imf.org/en/Countries/PAK" target="_blank" rel="noreferrer">{tx('IMF Pakistan')}</a>
        </div>
      </footer>
    </div>
  );
}

export default App;
