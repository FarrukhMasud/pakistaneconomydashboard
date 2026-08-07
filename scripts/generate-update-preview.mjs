#!/usr/bin/env node
import { execFileSync } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { DATASETS, getDatasetFreshness } from './data-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_DIR = resolve(ROOT, 'public', 'data');

function headFile(file) {
  try {
    return JSON.parse(execFileSync('git', ['show', `HEAD:public/data/${file}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }));
  } catch {
    return null;
  }
}

function dateValue(value) {
  const normalized = normalizeDate(value);
  const match = normalized?.match(/(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3] || 1));
}

function monthGap(from, to) {
  const a = normalizeDate(from)?.match(/(\d{4})-(\d{2})/);
  const b = normalizeDate(to)?.match(/(\d{4})-(\d{2})/);
  if (!a || !b) return null;
  return (Number(b[1]) - Number(a[1])) * 12 + Number(b[2]) - Number(a[2]);
}

function normalizeDate(value) {
  const text = String(value || '');
  const iso = text.match(/(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (iso) return iso[0];
  const named = text.match(/(?:End[-\s])?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s]+(\d{4})/i);
  if (!named) return null;
  const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    .indexOf(named[1].toLowerCase()) + 1;
  return `${named[2]}-${String(month).padStart(2, '0')}`;
}

function uniqueRevisionKey(entry) {
  return JSON.stringify([entry.dataset, entry.path, entry.from, entry.to, entry.date]);
}

async function readJson(file) {
  return JSON.parse(await readFile(resolve(DATA_DIR, file), 'utf8'));
}

async function main() {
  const newObservations = [];
  const sourceChanges = [];
  const suspiciousDateJumps = [];
  const reviewRequired = [];

  for (const dataset of DATASETS) {
    const current = await readJson(dataset.file);
    const previous = headFile(dataset.file);
    const now = getDatasetFreshness(dataset, current);

    if (previous) {
      const before = getDatasetFreshness(dataset, previous);
      if (now.observationDate && now.observationDate !== before.observationDate) {
        newObservations.push({
          dataset: dataset.id,
          label: dataset.label,
          from: before.observationDate,
          to: now.observationDate,
          cadence: dataset.cadence,
        });

        const fromTime = dateValue(before.observationDate);
        const toTime = dateValue(now.observationDate);
        const gap = monthGap(before.observationDate, now.observationDate);
        if (fromTime && toTime && toTime < fromTime) {
          suspiciousDateJumps.push({
            dataset: dataset.id,
            label: dataset.label,
            type: 'backward',
            from: before.observationDate,
            to: now.observationDate,
          });
        } else if (gap !== null && gap > 14) {
          suspiciousDateJumps.push({
            dataset: dataset.id,
            label: dataset.label,
            type: 'large-forward-jump',
            from: before.observationDate,
            to: now.observationDate,
          });
        }
      }

      const oldSource = previous.sourceUrl || previous.source || null;
      const newSource = current.sourceUrl || current.source || null;
      if (oldSource !== newSource) {
        sourceChanges.push({
          dataset: dataset.id,
          label: dataset.label,
          from: oldSource,
          to: newSource,
        });
      }
    }

    if (now.status !== 'fresh') {
      reviewRequired.push({
        dataset: dataset.id,
        label: dataset.label,
        status: now.status,
        reason: now.reviewReason || now.expectedLag || 'Outside the expected publication window.',
        observationDate: now.observationDate,
      });
    }
  }

  const currentKpis = await readJson('kpi-summary.json');
  const previousKpis = headFile('kpi-summary.json');
  const previousById = new Map((previousKpis?.indicators || []).map((indicator) => [indicator.id, indicator]));
  const majorMovements = (currentKpis.indicators || [])
    .map((indicator) => {
      const before = previousById.get(indicator.id);
      if (!before || before.value === indicator.value) return null;
      const delta = Number(indicator.value) - Number(before.value);
      const percent = Number(before.value) !== 0 ? (delta / Math.abs(Number(before.value))) * 100 : null;
      return {
        id: indicator.id,
        label: indicator.label,
        from: before.value,
        to: indicator.value,
        unit: indicator.unit,
        period: indicator.period,
        percent: percent === null ? null : Math.round(percent * 10) / 10,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.percent ?? b.to - b.from) - Math.abs(a.percent ?? a.to - a.from))
    .slice(0, 8);

  const revisions = await readJson('revisions.json');
  const previousRevisions = headFile('revisions.json');
  const previousRevisionKeys = new Set((previousRevisions?.entries || []).map(uniqueRevisionKey));
  const newRevisions = (revisions.entries || [])
    .filter((entry) => !previousRevisionKeys.has(uniqueRevisionKey(entry)))
    .slice(0, 12);

  const releaseCalendar = await readJson('release-calendar.json');
  const overdueReleases = (releaseCalendar.releases || [])
    .filter((release) => ['overdue', 'due'].includes(release.status))
    .map((release) => ({
      dataset: release.dataset,
      label: release.label,
      status: release.status,
      expectedDate: release.expectedDate,
    }));

  const output = {
    generatedAt: new Date().toISOString(),
    comparisonBase: (() => {
      try {
        return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
      } catch {
        return null;
      }
    })(),
    description: 'Pre-commit comparison of working-tree dashboard data against HEAD.',
    summary: {
      newObservations: newObservations.length,
      majorMovements: majorMovements.length,
      newRevisions: newRevisions.length,
      sourceChanges: sourceChanges.length,
      suspiciousDateJumps: suspiciousDateJumps.length,
      reviewRequired: reviewRequired.length,
      overdueReleases: overdueReleases.length,
    },
    newObservations,
    majorMovements,
    newRevisions,
    sourceChanges,
    suspiciousDateJumps,
    reviewRequired,
    overdueReleases,
  };

  await writeFile(resolve(DATA_DIR, 'update-preview.json'), `${JSON.stringify(output, null, 2)}\n`);
  console.log(`✅ Update preview: ${newObservations.length} observations, ${majorMovements.length} KPI movements, ${suspiciousDateJumps.length} suspicious date jumps`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
