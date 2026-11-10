import { Component, type ErrorInfo, type ReactNode } from 'react';
import { makeTranslator } from '../i18n/index.ts';
import { useSettings } from '../i18n/index.ts';

interface Props {
  children: ReactNode;
  /** Called by "Close" (e.g. close the sheet that failed). */
  onReset?: () => void;
}

/**
 * A rendering error never blanks the whole screen: the failing part is replaced by a message with the error and
 * a way out (close / reload). The game state itself is not touched.
 */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { t } = makeTranslator(useSettings.getState().lang);
    return (
      <section className="panel error-panel" role="alert">
        <h3>{t('err.ui.title')}</h3>
        <p className="muted">{t('err.ui.body')}</p>
        <pre className="mono">{error.message}</pre>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={this.reset}>
            {t('common.close')}
          </button>
          <button className="btn" onClick={() => window.location.reload()}>
            {t('err.ui.reload')}
          </button>
        </div>
      </section>
    );
  }
}
