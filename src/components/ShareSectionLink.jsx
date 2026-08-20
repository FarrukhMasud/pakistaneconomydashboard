import { useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import { embedSnippet, sectionUrl } from '../utils/shareLinks.js';

/**
 * Share a deep link (copy, X, LinkedIn, WhatsApp) or an embeddable iframe.
 */
export default function ShareSectionLink({ groupId, sectionId, label }) {
  const [copied, setCopied] = useState(null);
  const { t } = useI18n();
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const markCopied = (kind) => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const copy = async (value, kind) => {
    try {
      await navigator.clipboard.writeText(value);
      markCopied(kind);
    } catch {
      window.prompt(t('common.copyLink'), value);
    }
  };

  const openShare = (href) => {
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const onNativeShare = async () => {
    try {
      await navigator.share({
        title: `${label} — Pakistan Economic Dashboard`,
        url: sectionUrl(groupId, sectionId),
      });
    } catch {
      /* user cancelled */
    }
  };

  const shareHref = (network) => {
    const url = sectionUrl(groupId, sectionId);
    const text = `${label} — Pakistan Economic Dashboard`;
    if (network === 'x') {
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    }
    if (network === 'linkedin') {
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    }
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(`${text} ${url}`)}`;
  };

  return (
    <details className="share-menu">
      <summary className="share-section-link">{t('common.share')}</summary>
      <div className="share-menu__panel" role="menu">
        {canNativeShare && (
          <button type="button" role="menuitem" onClick={onNativeShare}>
            {t('common.shareNative')}
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          onClick={() => copy(sectionUrl(groupId, sectionId), 'link')}
        >
          {copied === 'link' ? t('common.linkCopied') : t('common.copyLink')}
        </button>
        <button type="button" role="menuitem" onClick={() => openShare(shareHref('x'))}>
          {t('common.shareOnX')}
        </button>
        <button type="button" role="menuitem" onClick={() => openShare(shareHref('linkedin'))}>
          {t('common.shareOnLinkedIn')}
        </button>
        <button type="button" role="menuitem" onClick={() => openShare(shareHref('whatsapp'))}>
          {t('common.shareOnWhatsApp')}
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => copy(embedSnippet(sectionUrl(groupId, sectionId, { embed: true }), label), 'embed')}
        >
          {copied === 'embed' ? t('common.embedCopied') : t('common.copyEmbed')}
        </button>
      </div>
    </details>
  );
}
