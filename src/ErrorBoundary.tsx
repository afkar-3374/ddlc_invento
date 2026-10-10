import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

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
    console.error('Uncaught error in DDLC AI App:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0D0E] text-[#EDEDED] flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-[#101418] border border-[#232D35] rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-lg font-bold font-display text-white">
                DDLC AI Application Notice
              </h2>
              <p className="text-xs text-gray-400 mt-1 font-mono">
                An unexpected execution error occurred while initializing the view.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-[#080A0B] border border-[#1C252C] text-left font-mono text-[11px] text-red-400 overflow-x-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full py-2.5 rounded-xl bg-[#00FF66] text-[#0A0D0F] font-mono font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#1aff75] transition-colors cursor-pointer shadow-[0_0_12px_rgba(0,255,102,0.2)]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset & Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
