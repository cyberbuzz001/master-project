import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[TradeGrow Uncaught Error Boundary]:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b0e14] text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[var(--bg-surface,#121824)] border border-[var(--border-color,#1e293b)] rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-100">Application Notice</h2>
              <p className="text-xs text-slate-400">
                A rendering issue was prevented. Click below to refresh your session safely.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="p-3 bg-slate-900/60 rounded-xl text-[11px] font-mono text-slate-400 text-left overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="primary" size="sm" onClick={this.handleReload} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
                Reload Platform
              </Button>
              <Button variant="secondary" size="sm" onClick={this.handleReset} leftIcon={<LogOut className="w-3.5 h-3.5" />}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
