import { Component } from 'react';

/**
 * Catches render errors in a section so one bad chart cannot blank the app.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      const {
              fallback,
              onRetry,
              title = 'Something went wrong in this section',
              retryLabel = 'Try again',
            } = this.props;
            if (fallback) return fallback(this.state.error, () => this.setState({ error: null }));
            return (
              <div className="card data-state-card" role="alert">
                <strong className="data-state-card__title">{title}</strong>
                <p className="data-state-card__msg">{this.state.error.message || String(this.state.error)}</p>
                <button
                  type="button"
                  className="data-state-card__retry"
                  onClick={() => {
                    this.setState({ error: null });
                    onRetry?.();
                  }}
                >
                  {retryLabel}
                </button>
              </div>
            );
    }
    return this.props.children;
  }
}
