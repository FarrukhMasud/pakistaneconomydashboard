import { useData } from '../hooks/useData';
import { COLORS } from '../utils/chartConfig';
import { LoadingCard, ErrorCard, PublicationNotice } from './ui/DataState';
import FigureTrust from './FigureTrust';
import './ui/ImfTracker.css';
import useI18n from '../i18n/useI18n';

function formatDate(dateStr, options = { month: 'short', year: 'numeric' }) {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('en-US', options);
}

export default function ImfTracker() {
  const { tx } = useI18n();
  const { data, loading, error, retry, unavailable } = useData('imf-tracker.json');

  if (loading) return <LoadingCard label="Loading IMF tracker…" />;
  if (error || !data) return <ErrorCard error={error} unavailable={unavailable} onRetry={retry} label="Could not load IMF tracker" compact />;

  const {
    program,
    totalUSD,
    disbursedUSD,
    upcomingDecision,
    relatedFacilities,
    reviews = [],
    keyObjectives,
    programScorecard,
    sourceUrl,
    lastVerified,
    methodologyNote,
  } = data;

  const staffLevel = reviews.find(r => r.status === 'staff_level');
  const needsVerification = reviews.find(r => r.status === 'needs_verification');
  const disbursed = Number.isFinite(disbursedUSD) ? disbursedUSD : null;
  const remaining = Number.isFinite(totalUSD) && disbursed != null ? totalUSD - disbursed : null;
  const pctDisbursed = totalUSD > 0 && disbursed != null ? Math.round((disbursed / totalUSD) * 100) : null;
  const usd = (value, digits = 1) => Number.isFinite(value) ? `$${(value / 1000).toFixed(digits)}B` : '—';
  const nextReview = staffLevel || needsVerification || reviews.find(r => r.status === 'pending');

  return (
    <div className="imf-tracker card">
      <PublicationNotice data={data} />
      <FigureTrust datasetId="imf-tracker" data={data} period={data.asOf || data.programPeriod} />
      <div className="imf-tracker__header">
        <h3>🏛️ IMF Program Tracker</h3>
        <span className="imf-tracker__badge">
          {program}
        </span>
      </div>

      <div className="imf-tracker__summary">
        <div className="imf-stat">
          <span className="imf-stat__label">{tx("Total Program")}</span>
          <span className="imf-stat__value">{usd(totalUSD, 0)}</span>
          <FigureTrust datasetId="imf-tracker" data={data} field="totalUSD" period={data.programPeriod} compact />
        </div>
        <div className="imf-stat">
          <span className="imf-stat__label">{tx("Disbursed")}</span>
          <span className="imf-stat__value" style={{ color: COLORS.teal }}>
            {usd(disbursed)}
          </span>
          <FigureTrust datasetId="imf-tracker" data={data} field="disbursedUSD" period={data.asOf} compact />
        </div>
        <div className="imf-stat">
          <span className="imf-stat__label">{tx("Remaining")}</span>
          <span className="imf-stat__value" style={{ color: COLORS.amber }}>
            {usd(remaining)}
          </span>
          <FigureTrust datasetId="imf-tracker" data={data} period={data.asOf} derivation="Total program − published disbursements" compact />
        </div>
        <div className="imf-stat">
          <span className="imf-stat__label">{tx("Next")}</span>
          <span className="imf-stat__value" style={{ color: COLORS.blue }}>
            {nextReview ? `${nextReview.name}${staffLevel || needsVerification ? ' ⏳' : ''}` : reviews.length && reviews.every((review) => review.status === 'completed') ? 'Complete' : '—'}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {pctDisbursed != null && <div className="imf-progress">
        <div className="imf-progress__bar">
          <div
            className="imf-progress__fill"
            style={{ width: `${Math.min(100, Math.max(0, pctDisbursed))}%` }}
          />
        </div>
        <span className="imf-progress__label">{pctDisbursed}% disbursed</span>
      </div>}

      {upcomingDecision && (
        <div className="imf-next-decision">
          <div>
            <span className="imf-next-decision__label">
              {upcomingDecision.status === 'needs_verification' ? 'Board Outcome to Verify' : 'Next Board Decision'}
            </span>
            <strong>{upcomingDecision.dateText || formatDate(upcomingDecision.date, { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
          </div>
          <p>
            {upcomingDecision.note}
            {upcomingDecision.expectedRSFUsdM && (
              <>{tx("RSF amount is tracked separately from the EFF progress bar.")}</>
            )}
          </p>
        </div>
      )}

      {/* Program scorecard — performance against IMF conditions */}
      {programScorecard?.items?.length > 0 && (
        <div className="imf-scorecard">
          <h4>{tx("Performance vs IMF Conditions")}</h4>
          <div className="imf-scorecard__grid">
            {programScorecard.items.map((it, i) => (
              <div key={i} className={`imf-scorecard__item imf-scorecard__item--${it.met === true ? 'met' : it.met === false ? 'missed' : 'mixed'}`}>
                <span className="imf-scorecard__icon">{it.met === true ? '✓' : it.met === false ? '✕' : '≈'}</span>
                <div className="imf-scorecard__body">
                  <span className="imf-scorecard__label">{it.label}</span>
                  <span className="imf-scorecard__detail">
                    <strong>{it.actual}</strong>
                    {it.target && <> · target {it.target}</>}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {programScorecard.source && (
            <p className="imf-scorecard__src">Source: {programScorecard.source}</p>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="imf-timeline">
        {reviews.map((r, i) => (
          <div key={i} className={`imf-timeline__item imf-timeline__item--${r.status}`}>
            <div className="imf-timeline__dot" />
            <div className="imf-timeline__content">
              <span className="imf-timeline__name">{r.name}</span>
              <span className="imf-timeline__date">
                {r.status === 'staff_level'
                  ? `SLA ${formatDate(r.date)} · Board ${formatDate(r.expected, { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : r.status === 'needs_verification'
                    ? `SLA ${formatDate(r.date)} · Board date passed ${formatDate(r.expected, { month: 'short', day: 'numeric', year: 'numeric' })} — verify outcome`
                  : r.date ? formatDate(r.date) : r.expected ? `Expected ${r.expected}` : ''}
                {r.status === 'staff_level' && ' — Awaiting Board'}
              </span>
              <span className="imf-timeline__amount">{Number.isFinite(r.usdM) ? `$${r.usdM}M` : '—'}</span>
              <FigureTrust datasetId="imf-tracker" data={data} row={r} period={r.date || r.expected} compact />
            </div>
          </div>
        ))}
      </div>

      {relatedFacilities?.length > 0 && (
        <div className="imf-related">
          <h4>{tx("Related IMF Facility")}</h4>
          {relatedFacilities.map((facility) => (
            <div key={facility.program} className="imf-related__item">
              <strong>{facility.program}</strong>
              <span>
                {facility.status}
                {facility.disbursedUsdM != null && facility.totalUsdM != null
                  ? ` · $${facility.disbursedUsdM}M of $${(facility.totalUsdM / 1000).toFixed(1)}B disbursed`
                  : facility.expectedUsdM != null
                    ? ` · $${facility.expectedUsdM}M`
                    : ''}
              </span>
              <small>{facility.note}</small>
            </div>
          ))}
        </div>
      )}

      {/* Key Objectives */}
      {keyObjectives?.length > 0 && (
        <div className="imf-objectives">
          <h4>{tx("Key Program Objectives")}</h4>
          <ul>
            {keyObjectives.map((obj, i) => (
              <li key={i}>{obj}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer & Source */}
      <div className="imf-disclaimer">
        <p>
          ⓘ {methodologyNote}
          {lastVerified && <> Source checked: {formatDate(lastVerified)}.</>}
        </p>
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="source-link-pill">
          🔗 IMF Pakistan Page
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  );
}
