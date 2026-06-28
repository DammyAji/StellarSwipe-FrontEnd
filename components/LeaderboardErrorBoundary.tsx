"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class LeaderboardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[LeaderboardErrorBoundary] Leaderboard section crashed:", error, errorInfo.componentStack);
  }

  handleRetry = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center"
        >
          <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-semibold text-destructive">Leaderboard unavailable</p>
            <p className="mt-2 text-sm text-foreground-muted">
              Something went wrong loading the leaderboard. Other sections are unaffected.
            </p>
          </div>
          <Button variant="default" size="sm" onClick={this.handleRetry} className="flex items-center gap-2">
            <RefreshCw size={16} aria-hidden="true" />
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
