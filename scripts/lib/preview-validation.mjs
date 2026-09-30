import { sha256 } from './source-evidence.mjs';
import { officialDomain } from './source-evidence.mjs';

export function isOfficialDocumentResolution(change) {
  if (!change.from || !change.to || !officialDomain(change.from)
    || officialDomain(change.from) !== officialDomain(change.to)) return false;
  const before = new URL(change.from);
  const after = new URL(change.to);
  return /^\/?$/.test(before.pathname) && !before.search && !/^\/?$/.test(after.pathname);
}

export function previewHash(preview) {
  const { generatedAt: _generatedAt, comparisonBase: _comparisonBase, ...content } = preview;
  return sha256(JSON.stringify(content));
}

export function evaluateUpdatePreview(preview, approvals = []) {
  const problems = [];
  for (const jump of preview.suspiciousDateJumps || []) {
    problems.push(`${jump.dataset}: ${jump.type} observation change ${jump.from} -> ${jump.to}`);
  }
  for (const change of preview.sourceChanges || []) {
    if (!isOfficialDocumentResolution(change)) problems.push(`${change.dataset}: source changed`);
  }
  for (const movement of preview.majorMovements || []) {
    if (movement.percent != null && Math.abs(movement.percent) > 25) problems.push(`${movement.id}: material movement ${movement.percent}%`);
  }
  for (const revision of preview.newRevisions || []) {
    if (revision.kind === 'historical-revision' && revision.changePct != null && Math.abs(revision.changePct) > 25) {
      problems.push(`${revision.dataset}.${revision.path}: material historical restatement ${revision.changePct}%`);
    }
  }
  const approval = approvals.find(item => item.previewHash === previewHash(preview)
    && typeof item.reason === 'string' && item.reason.trim().length > 20
    && typeof item.approvedAt === 'string' && Number.isFinite(Date.parse(item.approvedAt))
    && Array.isArray(item.reviewers) && new Set(item.reviewers.filter(reviewer => typeof reviewer === 'string' && reviewer.trim()).map(reviewer => reviewer.trim().toLowerCase())).size >= 2);
  return { problems, approved: problems.length === 0 || Boolean(approval), previewHash: previewHash(preview) };
}
