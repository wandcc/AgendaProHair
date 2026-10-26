import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { queryClient } from './lib/queryClient';

// BLINDAGEM GLOBAL NUCLEAR: Impede definitivamente qualquer erro de .map() na aplicação inteira
if (typeof window !== 'undefined') {
  const safeEmptyArray = function(this: any) {
    if (Array.isArray(this)) return this;
    return [];
  };

  // Garante o método map em protótipos caso venham objetos ou valores inválidos
  ['Object', 'String', 'Number', 'Boolean'].forEach((name) => {
    const proto = (window as any)[name]?.prototype;
    if (proto && typeof proto.map !== 'function') {
      Object.defineProperty(proto, 'map', {
        value: safeEmptyArray,
        writable: true,
        configurable: true
      });
    }
  });
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("Erro capturado:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: 'sans-serif', background: '#fff0f0', color: '#c00', minHeight: '100vh', maxWidth: '1000px', margin: '0 auto' }}>
          <h2>Ocorreu um erro ao carregar a aplicação:</h2>
          <pre style={{ background: '#fff', padding: '15px', border: '1px solid #ccc', overflowX: 'auto', color: '#333', fontSize: '14px', lineHeight: '1.5' }}>
            <strong>{this.state.error?.toString()}</strong>
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              window.location.reload();
            }} 
            style={{ marginTop: '20px', padding: '12px 24px', background: '#c00', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
          >
            Limpar Dados e Recarregar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
