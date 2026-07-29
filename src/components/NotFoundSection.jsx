import useI18n from '../i18n/useI18n';

export default function NotFoundSection({ onGoHome, path }) {
  const { t } = useI18n();
  return (
    <section className="fade-in not-found card" role="alert">
      <h2>{t('route.notFound', 'Page not found')}</h2>
      <p>
        {t(
                'route.notFoundBody',
          'That link is not a dashboard section. Check the URL or return to the overview.',
        )}
      </p>
      {path && (
        <p className="not-found__path">
          <code>{path}</code>
        </p>
      )}
      <button type="button" className="data-state-card__retry" onClick={onGoHome}>
              {t('route.notFoundHome', 'Back to overview')}
      </button>
    </section>
  );
}
