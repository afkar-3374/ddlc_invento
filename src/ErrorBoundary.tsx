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
        <div className="min-h-screen bg-[#F5F9F6] text-[#25352C] flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-white border border-[#E6EDE7] rounded-3xl p-6 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#174D35]">
                DDLC AI Application Notice
              </h2>
              <p className="text-xs text-[#77857C] mt-1">
                An unexpected execution error occurred while initializing the view.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-left font-mono text-[11px] text-red-700 overflow-x-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full py-2.5 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
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
