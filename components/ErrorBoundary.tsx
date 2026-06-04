"use client";

import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Error capturado:", error, errorInfo);

    // Manejo específico para ChunkLoadError
    if (error.name === 'ChunkLoadError' || error.message?.includes('Loading chunk')) {
      console.warn("🔄 ChunkLoadError detectado - Forzando recarga de página...");
      // Pequeño delay antes de recargar para evitar loops infinitos
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <h2 className="text-2xl font-bold mb-4">Algo salió mal</h2>
          <p className="text-gray-600 mb-6">Ocurrió un error inesperado.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function SmallErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">Error en esta sección</p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
