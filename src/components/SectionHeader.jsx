import { useState } from 'react';
import EditorialNote from './EditorialNote';
import SourceBadge from './SourceBadge';
import useI18n from '../i18n/useI18n';
import { SECTION_GUIDANCE } from '../utils/sectionGuidance';

export default function SectionHeader({ title, description, sourceLinks, noteKey, datasetId }) {
  const [expanded, setExpanded] = useState(false);
  const { t, tx } = useI18n();
  const guidance = SECTION_GUIDANCE[datasetId];

  return (
    <div className="section-header-block">
      <h2 className="section-title">
        {tx(title)}
        {datasetId && <SourceBadge datasetId={datasetId} />}
      </h2>
      <div className="section-header-actions">
        <button
          className="section-intro-toggle"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? `▾ ${t('section.hideOverview', 'Hide overview')}` : `▸ ${t('section.aboutSection', 'About this section')}`}
        </button>
        {sourceLinks?.length > 0 && (
          <div className="source-links">
            {sourceLinks.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="source-link-pill"
              >
                🔗 {link.label}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            ))}
          </div>
        )}
      </div>
      <div
        className={`section-intro-panel ${expanded ? 'expanded' : ''}`}
        aria-hidden={!expanded}
      >
        <div>
          <p className="section-intro">{tx(description)}</p>
          {noteKey && <EditorialNote noteKey={noteKey} />}
        </div>
      </div>
      {guidance && (
        <div className="section-decision-guide">
          <p><strong>{t('section.whyItMatters', 'Why it matters')}</strong>{guidance.why}</p>
          <p><strong>{t('section.watchNext', 'Watch next')}</strong>{guidance.watch}</p>
        </div>
      )}
    </div>
  );
}
