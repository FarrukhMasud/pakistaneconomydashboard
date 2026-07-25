import SectionHeader from './SectionHeader';
import useI18n from '../i18n/useI18n';

const FEEDBACK_EMAIL = ['feedback', 'economyofpakistan.com'].join('@');

export default function FeedbackSection() {
  const { tx } = useI18n();
  return (
    <section className="fade-in">
      <SectionHeader
        title="Feedback"
        description="Send corrections, source links, missing indicators, or suggestions for improving the dashboard."
      />

      <div className="feedback-card card">
        <div className="feedback-card__intro">
          <span className="feedback-card__icon">✉️</span>
          <div>
            <h3>Have a correction or suggestion?</h3>
            <p>
              Email data corrections, missing source links, usability issues,
              or new indicator requests here:
            </p>
          </div>
        </div>

        <a className="feedback-email" href={`mailto:${FEEDBACK_EMAIL}`}>
          {FEEDBACK_EMAIL}
        </a>
        <p className="feedback-note">{tx("Please include the chart or tracker name and a source link when reporting data issues.")}</p>
      </div>
    </section>
  );
}
