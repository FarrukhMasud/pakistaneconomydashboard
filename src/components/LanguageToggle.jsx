import { LANGUAGES } from '../i18n/context';
import { useI18n } from '../i18n/useI18n';

export default function LanguageToggle() {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="lang-toggle" role="radiogroup" aria-label={t('app.language')}>
      {Object.values(LANGUAGES).map((option) => (
        <button
          key={option.id}
          type="button"
          className={`lang-toggle-btn ${lang === option.id ? 'active' : ''}`}
          onClick={() => setLang(option.id)}
          aria-pressed={lang === option.id}
          lang={option.id}
          title={option.label}
        >
          {option.short}
        </button>
      ))}
    </div>
  );
}
