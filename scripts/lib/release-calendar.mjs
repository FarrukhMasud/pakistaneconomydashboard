/**
 * Release-calendar estimation.
 *
 * Everything here is *derived from the published data itself* — we never
 * hardcode a release date. For each dataset we look at the actual observation
 * history that is already on the dashboard, measure how far apart consecutive
 * observations are, measure how long after an observation period closes the
 * dashboard was actually able to record a change, and project the next release
 * from those two measurements.
 *
 * The output always carries the `basis` string that explains exactly how each
 * date was produced so the UI can state it verbatim. Estimated dates are never
 * presented as an official release calendar.
 */

const DAY_MS = 86_400_000;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;

/** Last calendar day covered by an observation label (`2026-06` -> `2026-06-30`). */
export function periodEndDate(value) {
  if (typeof value !== 'string') return null;
  if (ISO_DAY.test(value)) return value;
  if (ISO_MONTH.test(value)) {
    const [year, month] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  }
  return null;
}

function toTime(isoDay) {
  return Date.parse(`${isoDay}T00:00:00Z`);
}

function addDays(isoDay, days) {
  return new Date(toTime(isoDay) + days * DAY_MS).toISOString().slice(0, 10);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Median spacing between the most recent observations.
 * `sampleSize` caps how far back we look so a cadence change (for example a
 * series that switched from weekly to monthly) is reflected quickly.
 */
export function observedInterval(observations, sampleSize = 12) {
  const raw = (observations || []).filter(value => periodEndDate(value));
  if (!raw.length) return null;

  // A series can mix granularities (SBP reserves keeps month-end history but
  // publishes weekly once the current month starts). Measure the cadence the
  // series is *currently* published at, not the average of both regimes.
  const tailGranularity = ISO_DAY.test(raw.at(-1)) ? ISO_DAY : ISO_MONTH;
  const sameGranularity = raw.filter(value => tailGranularity.test(value));
  const chosen = sameGranularity.length >= 3 ? sameGranularity : raw;

  const ends = chosen.map(periodEndDate).filter(Boolean).sort();
  const unique = [...new Set(ends)];
  if (unique.length < 3) return null;

  const recent = unique.slice(-(sampleSize + 1));
  const gaps = [];
  for (let i = 1; i < recent.length; i += 1) {
    const gap = Math.round((toTime(recent[i]) - toTime(recent[i - 1])) / DAY_MS);
    if (gap > 0) gaps.push(gap);
  }
  const days = median(gaps);
  if (!days) return null;
  return { days, samples: gaps.length, lastObservationEnd: unique.at(-1) };
}

/**
 * How long after a period closed the dashboard first recorded the release.
 * `dashboardUpdated` only advances when the published numbers actually change
 * (see data-writer.mjs), so it is a fair proxy for "when the source published".
 */
export function observedPublicationLag(lastObservationEnd, dashboardUpdated) {
  if (!lastObservationEnd || typeof dashboardUpdated !== 'string') return null;
  const updated = Date.parse(dashboardUpdated);
  if (Number.isNaN(updated)) return null;
  const lag = Math.round((updated - toTime(lastObservationEnd)) / DAY_MS);
  if (lag < 0) return null;
  // A lag beyond a quarter means we backfilled history rather than caught a
  // fresh release; refuse to extrapolate from it.
  if (lag > 92) return null;
  return lag;
}

function graceDays(intervalDays) {
  return Math.min(21, Math.max(3, Math.round(intervalDays * 0.5)));
}

/**
 * Build one release-calendar row.
 *
 * Returns `{ ..., basis }` describing the derivation, or a row with
 * `schedule: 'announced'` when the dataset itself carries an officially
 * announced next date, or `schedule: 'event-driven'` when no projection is
 * defensible.
 */
export function buildReleaseRow({ dataset, data, freshness, now = new Date() }) {
  const today = now.toISOString().slice(0, 10);
  const base = {
    id: dataset.id,
    label: dataset.label,
    cadence: dataset.cadence,
    source: dataset.source,
    sourceUrl: dataset.sourceUrl,
    sourceType: freshness?.sourceType || dataset.sourceType || 'official-primary',
    critical: Boolean(dataset.critical),
    latestObservation: freshness?.latestObservation || null,
    dashboardUpdated: freshness?.dashboardUpdated || null,
    releaseCalendarUrl: dataset.releaseCalendarUrl || null,
  };

  const announced = dataset.announcedNext?.(data);
  if (announced?.dateText || announced?.date) {
    return {
      ...base,
      schedule: 'announced',
      expectedNextObservation: null,
      expectedRelease: announced.date || null,
      expectedReleaseText: announced.dateText || announced.date,
      windowEnd: announced.date || null,
      status: announced.date && announced.date < today ? 'overdue' : 'scheduled',
      daysLate: announced.date && announced.date < today
        ? Math.round((toTime(today) - toTime(announced.date)) / DAY_MS)
        : 0,
      basis: announced.note
        ? `Announced by the source. ${announced.note}`
        : 'Announced by the source.',
    };
  }

  const observations = dataset.observations?.(data);
  const interval = observedInterval(observations);
  if (!interval) {
    return {
      ...base,
      schedule: 'event-driven',
      expectedNextObservation: null,
      expectedRelease: null,
      expectedReleaseText: null,
      windowEnd: null,
      status: 'event-driven',
      daysLate: 0,
      basis: dataset.expectedLag || 'Released irregularly; no repeating interval to project from.',
    };
  }

  const lag = observedPublicationLag(interval.lastObservationEnd, base.dashboardUpdated);
  const expectedNextObservationEnd = addDays(interval.lastObservationEnd, interval.days);
  const expectedRelease = addDays(expectedNextObservationEnd, lag ?? 0);
  const grace = graceDays(interval.days);
  const windowEnd = addDays(expectedRelease, grace);

  let status = 'scheduled';
  if (today > windowEnd) status = 'overdue';
  else if (today >= expectedRelease) status = 'due';

  const lagText = lag == null
    ? 'publication lag unknown, so the window starts as soon as the period closes'
    : `plus the ${lag}-day lag observed on the current release`;

  return {
    ...base,
    schedule: 'estimated',
    intervalDays: interval.days,
    intervalSamples: interval.samples,
    publicationLagDays: lag,
    expectedNextObservation: expectedNextObservationEnd,
    expectedRelease,
    expectedReleaseText: null,
    windowEnd,
    status,
    daysLate: status === 'overdue'
      ? Math.round((toTime(today) - toTime(windowEnd)) / DAY_MS)
      : 0,
    basis: `Estimated: median gap of ${interval.days} days across the last ${interval.samples} observations, ${lagText}. Not an official release calendar.`,
  };
}

export const RELEASE_STATUS_ORDER = ['overdue', 'due', 'scheduled', 'event-driven'];

export function sortReleaseRows(rows) {
  return [...rows].sort((a, b) => {
    const byStatus = RELEASE_STATUS_ORDER.indexOf(a.status) - RELEASE_STATUS_ORDER.indexOf(b.status);
    if (byStatus !== 0) return byStatus;
    if (a.expectedRelease && b.expectedRelease) return a.expectedRelease.localeCompare(b.expectedRelease);
    if (a.expectedRelease) return -1;
    if (b.expectedRelease) return 1;
    return a.label.localeCompare(b.label);
  });
}
