import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * App-wide safety net (spec 1.9, 1.11): a render error must NEVER show the user a
 * blank page. Instead we catch it and render a clear, persistent red banner with
 * a way to recover. No stack traces or model/vendor details are shown.
 */
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error && error.message ? error.message : 'Something went wrong.';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Log for developers only; never surfaced to the user.
    console.error('[error-boundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex h-full w-full items-center justify-center bg-canvas p-6">
        <div
          role="alert"
          className="w-full max-w-lg rounded-xl border border-red-300 bg-red-50 p-6 text-red-800 shadow-card dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          <h2 className="text-base font-semibold">Something went wrong on this screen</h2>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">{this.state.message}</p>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            Your saved work is safe. You can try again or reload the app.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={this.handleReset}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-red-300 bg-transparent px-4 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/40"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
