import { useState } from 'react';

export default function SectionHeader({ title, description }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="section-header-block">
      <h2 className="section-title">{title}</h2>
      <button
        className="section-intro-toggle"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? '▾ Hide overview' : '▸ About this section'}
      </button>
      <div className={`section-intro-panel ${expanded ? 'expanded' : ''}`}>
        <div>
          <p className="section-intro">{description}</p>
        </div>
      </div>
    </div>
  );
}
