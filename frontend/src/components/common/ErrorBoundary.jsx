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
      const errorMsg = this.state.error?.message || 'Erro inesperado durante a exibição dos dados.';
      return (
        <div className="main-wrapper" style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="panel-card" style={{ borderTop: '4px solid #EF4444', maxWidth: '640px', margin: '2rem auto' }}>
            <AlertCircle size={48} color="#EF4444" style={{ marginBottom: '1rem' }} />
            
            <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '6px 12px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 800, display: 'inline-block', marginBottom: '12px' }}>
              ⚠️ [TIPO DE ERRO: RENDERIZAÇÃO DE COMPONENTE - UI_RENDER_ERROR]
            </div>

            <h2 style={{ color: '#991B1B', fontFamily: 'Outfit, sans-serif' }}>Ops! Ocorreu um erro na exibição do formulário.</h2>
            
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px', borderRadius: '8px', margin: '1rem 0', textWrap: 'wrap', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.85rem', color: '#B91C1C' }}>
              <strong>Detalhe do Erro:</strong> {errorMsg}
            </div>

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

