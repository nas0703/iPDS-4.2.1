/**
 * Enterprise IPDS Error Boundary Component
 * Handles unexpected React component tree errors gracefully with fallback UI and logging.
 */
import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react';
import { reportClientError } from '../../lib/observability';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  moduleName?: string;
  compact?: boolean;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, showDetails: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary caught an exception in [${this.props.moduleName || 'App'}]:`, error, errorInfo);
    this.setState({ errorInfo });
    try {
      reportClientError(error, { 
        module: this.props.moduleName || 'UnknownModule',
        componentStack: errorInfo.componentStack || '' 
      });
    } catch {
      // Ignore reporting error
    }
  }

  private handleReset = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    const isChunkError = 
      this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
      this.state.error?.message?.includes('Importing a module script failed') ||
      this.state.error?.message?.includes('Loading chunk');

    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    if (!this.props.compact || isChunkError) {
      window.location.reload();
    }
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      if (this.props.compact) {
        return (
          <div className="w-full p-5 my-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-slate-200 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                <AlertTriangle size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-400">
                  Ralat Paparan: {this.props.moduleName || 'Modul'}
                </h4>
                <p className="text-[11px] text-slate-300 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Modul ini mengalami gangguan teknikal sementara. Tab dan bahagian lain dalam sistem kekal berfungsi seperti biasa.
                </p>

                {this.state.error && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={this.toggleDetails}
                      className="text-[10px] text-rose-400/80 hover:text-rose-300 underline font-medium cursor-pointer"
                    >
                      {this.state.showDetails ? 'Sembunyikan log ralat' : 'Lihat log ralat'}
                    </button>
                    {this.state.showDetails && (
                      <div className="mt-1.5 p-2.5 rounded-lg bg-slate-950/80 border border-rose-900/50 font-mono text-[10px] text-rose-300 max-h-24 overflow-y-auto">
                        {this.state.error.message}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-xl text-[10.5px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm shadow-rose-900/30 cursor-pointer"
              >
                <RefreshCw size={12} />
                Pulihkan Paparan Ini
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen w-full bg-slate-950 text-white flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
              <AlertOctagon size={32} />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black uppercase tracking-tight text-white">
                Ralat Sistem Dikesan {this.props.moduleName ? `(${this.props.moduleName})` : ''}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Aplikasi mengalami masalah yang tidak dijangka. Data ladang anda kekal selamat dan terlindung. Sila muat semula halaman.
              </p>
            </div>

            {this.state.error && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="text-[11px] text-slate-500 hover:text-slate-400 underline cursor-pointer transition-colors"
                >
                  {this.state.showDetails ? 'Sembunyikan Maklumat Teknikal' : 'Tunjukkan Maklumat Teknikal Ringkas'}
                </button>
                {this.state.showDetails && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-left font-mono text-[11px] text-rose-400 overflow-x-auto max-h-32 custom-scrollbar">
                    <p className="font-bold text-rose-300 mb-1">{this.state.error.name}: {this.state.error.message}</p>
                    {this.state.errorInfo && (
                      <p className="text-[10px] text-slate-500 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack?.slice(0, 300)}...
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw size={16} />
              Muat Semula Aplikasi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
