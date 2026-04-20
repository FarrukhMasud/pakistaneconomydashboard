import { useState } from 'react';

export default function SectionHeader({ title, description, sourceLinks }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="section-header-block">
      <h2 className="section-title">{title}</h2>
      <div className="section-header-actions">
        <button
          className="section-intro-toggle"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? '▾ Hide overview' : '▸ About this section'}
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
      <div className={`section-intro-panel ${expanded ? 'expanded' : ''}`}>
        <div>
          <p className="section-intro">{description}</p>
        </div>
      </div>
    </div>
  );
}
