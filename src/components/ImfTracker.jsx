import { useData } from '../hooks/useData';
import { COLORS } from '../utils/chartConfig';
import './ui/ImfTracker.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function ImfTracker() {
  const { data, loading, error } = useData('imf-tracker.json');

  if (loading || !data) return null;
  if (error) return null;

  const { program, approved, totalUSD, disbursedUSD, reviews, keyObjectives, sourceUrl, lastVerified, methodologyNote } = data;

  const completed = reviews.filter(r => r.status === 'completed');
  const staffLevel = reviews.find(r => r.status === 'staff_level');
  const disbursed = disbursedUSD || completed.reduce((s, r) => s + r.usdM, 0);
  const pctDisbursed = Math.round((disbursed / totalUSD) * 100);
  const nextReview = staffLevel || reviews.find(r => r.status === 'pending');

  return (
    <div className="imf-tracker card">
      <div className="imf-tracker__header">
        <h3>🏛️ IMF Program Tracker</h3>
        <span className="imf-tracker__badge">
          {program}
        </span>
      </div>

      <div className="imf-tracker__summary">
        <div className="imf-stat">
          <span className="imf-stat__label">Total Program</span>
          <span className="imf-stat__value">${(totalUSD / 1000).toFixed(0)}B</span>
        </div>
        <div className="imf-stat">
          <span className="imf-stat__label">Disbursed</span>
          <span className="imf-stat__value" style={{ color: COLORS.teal }}>
            ${(disbursed / 1000).toFixed(1)}B
          </span>
        </div>
        <div className="imf-stat">
          <span className="imf-stat__label">Remaining</span>
          <span className="imf-stat__value" style={{ color: COLORS.amber }}>
            ${((totalUSD - disbursed) / 1000).toFixed(1)}B
          </span>
        </div>
        <div className="imf-stat">
          <span className="imf-stat__label">Next</span>
          <span className="imf-stat__value" style={{ color: COLORS.blue }}>
            {nextReview ? `${nextReview.name}${staffLevel ? ' ⏳' : ''}` : 'Complete'}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="imf-progress">
        <div className="imf-progress__bar">
          <div
            className="imf-progress__fill"
            style={{ width: `${pctDisbursed}%` }}
          />
        </div>
        <span className="imf-progress__label">{pctDisbursed}% disbursed</span>
      </div>

      {/* Timeline */}
      <div className="imf-timeline">
        {reviews.map((r, i) => (
          <div key={i} className={`imf-timeline__item imf-timeline__item--${r.status}`}>
            <div className="imf-timeline__dot" />
            <div className="imf-timeline__content">
              <span className="imf-timeline__name">{r.name}</span>
              <span className="imf-timeline__date">
                {r.date ? formatDate(r.date) : r.expected ? `Expected ${r.expected}` : ''}
                {r.status === 'staff_level' && ' — Awaiting Board'}
              </span>
              <span className="imf-timeline__amount">${r.usdM}M</span>
            </div>
          </div>
        ))}
      </div>

      {/* Key Objectives */}
      {keyObjectives?.length > 0 && (
        <div className="imf-objectives">
          <h4>Key Program Objectives</h4>
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
          {lastVerified && <> Last verified: {formatDate(lastVerified + 'T00:00:00')}.</>}
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
