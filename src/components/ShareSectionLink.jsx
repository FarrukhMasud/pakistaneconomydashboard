import { useState } from 'react';
import { useI18n } from '../i18n/useI18n';

/**
 * Copies a deep link to the current section so a specific chart or figure can
 * be cited in a report, email or chat rather than "go to the dashboard and
 * click around".
 */
export default function ShareSectionLink({ groupId, sectionId, label }) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();
  const href = `/${groupId}/${sectionId}`;

  const copy = async () => {
      const state = window.location.pathname === href ? window.location.search : '';
      const url = `${window.location.origin}${href}${state}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  return (
    <button
      type="button"
      className="share-section-link"
      onClick={copy}
      title={`${t('common.copyLink')} — ${label}`}
      aria-label={`${t('common.copyLink')} — ${label}`}
    >
      {copied ? `✅ ${t('common.linkCopied')}` : `🔗 ${t('common.copyLink')}`}
    </button>
  );
}
