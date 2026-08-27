import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error Boundary capturou um erro:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="main-wrapper" style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="panel-card" style={{ borderTop: '4px solid #EF4444', maxWidth: '600px', margin: '2rem auto' }}>
            <AlertCircle size={48} color="#EF4444" style={{ marginBottom: '1rem' }} />
            <h2 style={{ color: '#991B1B', fontFamily: 'Outfit, sans-serif' }}>Ops! Ocorreu um erro na exibição do formulário.</h2>
            <p style={{ color: '#4B5563', fontSize: '0.9rem', margin: '1rem 0' }}>
              {this.state.error?.message || 'Erro inesperado durante a exibição dos dados.'}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              <RefreshCw size={16} /> Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
