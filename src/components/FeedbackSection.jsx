import { useMemo, useState } from 'react';
import SectionHeader from './SectionHeader';

const FEEDBACK_EMAIL = ['feedback', 'economyofpakistan.com'].join('@');

export default function FeedbackSection() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    topic: 'Data correction',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const mailtoHref = useMemo(() => {
    const subject = `Pakistan Economic Dashboard feedback: ${form.topic}`;
    const body = [
      `Topic: ${form.topic}`,
      form.name ? `Name: ${form.name}` : null,
      form.email ? `Reply-to: ${form.email}` : null,
      '',
      form.message,
    ].filter((line) => line !== null).join('\n');

    return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [form]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setSubmitted(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
    window.location.href = mailtoHref;
  };

  return (
    <section className="fade-in">
      <SectionHeader
        title="Feedback"
        description="Send corrections, source links, missing indicators, or suggestions for improving the dashboard. Messages go to the domain address only; the underlying mailbox is not exposed on the site."
      />

      <div className="feedback-card card">
        <div className="feedback-card__intro">
          <span className="feedback-card__icon">✉️</span>
          <div>
            <h3>Help improve the dashboard</h3>
            <p>
              Use this form for data corrections, missing source links, usability issues,
              or new indicator requests.
            </p>
          </div>
        </div>

        <form className="feedback-form" onSubmit={handleSubmit}>
          <div className="feedback-form__row">
            <label>
              <span>Name <small>(optional)</small></span>
              <input
                name="name"
                value={form.name}
                onChange={updateField}
                autoComplete="name"
                placeholder="Your name"
              />
            </label>
            <label>
              <span>Email <small>(optional, for replies)</small></span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={updateField}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
          </div>

          <label>
            <span>Feedback type</span>
            <select name="topic" value={form.topic} onChange={updateField}>
              <option>Data correction</option>
              <option>Missing source</option>
              <option>Feature request</option>
              <option>Bug report</option>
              <option>General feedback</option>
            </select>
          </label>

          <label>
            <span>Message</span>
            <textarea
              name="message"
              value={form.message}
              onChange={updateField}
              placeholder="Tell me what changed, which chart or tracker it affects, and include a source link if available."
              rows={7}
              required
            />
          </label>

          <div className="feedback-form__actions">
            <button type="submit" className="feedback-submit">
              Send feedback
            </button>
            <p>
              Opens your email app addressed to <strong>{FEEDBACK_EMAIL}</strong>.
            </p>
          </div>

          {submitted && (
            <p className="feedback-form__status" role="status">
              Your email app should open with the feedback pre-filled. If it does not,
              email <a href={`mailto:${FEEDBACK_EMAIL}`}>{FEEDBACK_EMAIL}</a> directly.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
