"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: { error: Error; reset: () => void }) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  reset = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback({
          error: this.state.error || new Error("Unknown error"),
          reset: this.reset,
        });
      }

      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-200 flex flex-col items-center justify-center text-center gap-3 my-4"
        >
          <AlertTriangle className="text-red-400" size={32} />
          <div>
            <h3 className="font-bold text-white text-base">Ocorreu um erro ao carregar esta seção</h3>
            <p className="text-xs text-red-200/80 mt-1 max-w-md">
              {this.state.error?.message || "Erro inesperado na renderização."}
            </p>
          </div>
          <button
            type="button"
            onClick={this.reset}
            className="btn-ghost flex items-center gap-2 text-xs bg-white/10 hover:bg-white/20 text-white rounded-xl px-4 py-2 mt-2"
          >
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
