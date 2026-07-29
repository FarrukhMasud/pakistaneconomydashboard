import { useData } from '../hooks/useData';
import SourceBadge from './SourceBadge';
import { LoadingCard, ErrorCard } from './ui/DataState';
import { useI18n } from '../i18n/useI18n';

const SOURCE_LINKS = [
  { label: 'PBS advance release calendar', url: 'https://www.pbs.gov.pk/advance-release-calendar' },
  { label: 'SBP economic data', url: 'https://www.sbp.org.pk/ecodata/index2.asp' },
];

const STATUS_KEYS = ['overdue', 'due', 'scheduled', 'event-driven'];

function formatDay(value, lang) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

function expectedText(row, lang, t) {
  if (row.schedule === 'announced') return row.expectedReleaseText || formatDay(row.expectedRelease, lang) || t('release.status.scheduled');
  if (row.schedule === 'event-driven') return t('release.noFixedSchedule');
  const start = formatDay(row.expectedRelease, lang);
  const end = formatDay(row.windowEnd, lang);
  if (start && end && start !== end) return `${start} – ${end}`;
  return start || '—';
}

/**
 * Shows when each dataset is next expected. "Estimated" rows are projected from
 * the observed publication history of the series itself — the derivation is
 * printed on every row so a reader can tell a projection from an announcement.
 */
export default function ReleaseCalendarSection({ compact = false }) {
  const { data, loading, error, retry } = useData('release-calendar.json');
  const { t, lang } = useI18n();

  if (loading) return <LoadingCard label={`${t('release.title')}…`} />;
  if (error || !data?.releases?.length) {
    if (error || !data) {
      return (
        <ErrorCard
          error={error}
          onRetry={retry}
          label="Could not load release calendar"
          compact={compact}
        />
      );
    }
    return null;
  }

  const rows = compact
    ? data.releases.filter(row => row.status === 'overdue' || row.status === 'due' || row.critical).slice(0, 8)
    : data.releases;

  return (
    <section className={compact ? 'release-calendar card' : 'fade-in'}>
      {!compact && (
        <div className="section-header-block">
          <h2 className="section-title">{t('release.title')}</h2>
          <div className="section-header-actions">
            <div className="source-links">
              {SOURCE_LINKS.map(link => (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="source-link-pill">
                  🔗 {link.label}
                </a>
              ))}
            </div>
          </div>
          <p className="section-intro">{data.description}</p>
        </div>
      )}

      {compact && (
        <div className="data-freshness__header">
          <div>
            <h3>{t('release.compactTitle')}</h3>
            <p>{t('release.compactSubtitle')}</p>
          </div>
          <span className={`freshness-badge freshness-badge--${data.overdueCount > 0 ? 'needs-review' : 'fresh'}`}>
            <span className="freshness-badge__dot" />
            {data.overdueCount > 0 ? `${data.overdueCount} ${t('release.overdueCount')}` : t('release.onTrack')}
          </span>
        </div>
      )}

      <div className="release-list">
        {rows.map(row => (
          <div key={row.id} className={`release-row release-row--${row.status}`}>
            <div className="release-row__main">
              <strong>{row.label}</strong>
              <SourceBadge sourceType={row.sourceType} compact />
              <span className={`release-status release-status--${row.status}`}>
                {STATUS_KEYS.includes(row.status) ? t(`release.status.${row.status}`) : row.status}
                {row.daysLate > 0 && ` · ${row.daysLate}d`}
              </span>
            </div>
            <div className="release-row__meta">
              <span><em>{t('common.nextExpected')}:</em> {expectedText(row, lang, t)}</span>
              <span><em>{t('common.latestPublished')}:</em> {row.latestObservation || '—'}</span>
              <span><em>{t('common.cadence')}:</em> {row.cadence}</span>
              {row.releaseCalendarUrl && (
                <a href={row.releaseCalendarUrl} target="_blank" rel="noopener noreferrer">{t('release.sourcePage')}</a>
              )}
            </div>
            {!compact && <p className="release-row__basis">{row.basis}</p>}
          </div>
        ))}
      </div>

      {!compact && (
        <p className="insight-note">
          {t('release.disclaimer')} {data.generatedAt?.slice(0, 10)}
        </p>
      )}
    </section>
  );
}
