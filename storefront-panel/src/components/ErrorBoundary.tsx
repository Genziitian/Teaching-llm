import { Component, type ReactNode, type ErrorInfo } from 'react';
import ErrorPage from './ErrorPage';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <ErrorPage
          code={500}
          title={this.props.fallbackTitle || 'Something Went Wrong'}
          description="A component encountered an unexpected error while loading this page."
          showReload
          errorMessage={this.state.error?.message}
          onReload={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}
