import { useState } from 'react';
import useI18n from '../i18n/useI18n';
import { useDensity } from '../hooks/useDensity';
import NavigationDialog from './NavigationDialog';

export default function MobileViewSettings({ theme, setTheme }) {
  const { t, lang, setLang } = useI18n();
  const { density, setDensity } = useDensity();
  const [open, setOpen] = useState(false);
  const settings = [
    {
      id: 'language', label: t('app.language', 'Language'), value: lang, change: setLang,
      options: [
        { value: 'en', label: t('settings.english', 'English'), lang: 'en' },
        { value: 'ur', label: t('settings.urdu', 'اردو'), lang: 'ur' },
      ],
    },
    {
      id: 'theme', label: t('settings.theme', 'Theme'), value: theme, change: setTheme,
      options: [
        { value: 'light', label: t('settings.light', 'Light') },
        { value: 'system', label: t('settings.system', 'System') },
        { value: 'dark', label: t('settings.dark', 'Dark') },
      ],
    },
    {
      id: 'detail', label: t('density.label', 'Detail level'), value: density, change: setDensity,
      options: [
        { value: 'compact', label: t('density.compact', 'Brief view') },
        { value: 'comfortable', label: t('density.comfortable', 'Analyst view') },
      ],
    },
  ];
  return (
    <>
      <button
        type="button"
        className="view-settings-trigger navigation-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {t('settings.title', 'View settings')}
      </button>
      {open && (
        <NavigationDialog title={t('settings.title', 'View settings')} onClose={() => setOpen(false)} className="view-settings-dialog">
          {settings.map((setting) => (
            <fieldset key={setting.id} className="view-settings-group">
              <legend>{setting.label}</legend>
              <div className="view-settings-options">
                {setting.options.map((option) => (
                  <label key={option.value} lang={option.lang}>
                    <input type="radio" name={`view-${setting.id}`} value={option.value}
                      checked={setting.value === option.value} onChange={() => setting.change(option.value)} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <p className="navigation-dialog__description">
            {t('settings.detailHint', 'Brief keeps the overview concise. Analyst shows more context and detail. Charts and source data stay available in both views.')}
          </p>
        </NavigationDialog>
      )}
    </>
  );
}
