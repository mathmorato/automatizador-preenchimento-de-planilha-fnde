import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { ShieldAlert, CheckCircle2, Key, ArrowRight } from 'lucide-react';
import { verifyGoogleToken } from '../../services/api';

export default function GoogleLoginCard({ onLoginSuccess }) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeClientId, setActiveClientId] = useState(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
  );
  const [inputClientId, setInputClientId] = useState('');

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError(null);
    try {
      const idToken = credentialResponse.credential;
      const data = await verifyGoogleToken(idToken);
      if (data.authenticated) {
        onLoginSuccess(data.user, idToken);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Erro ao validar login do Google.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Erro 401 do Google: O Client ID informado não foi encontrado ou não está autorizado no Google Cloud Console.');
  };

  const handleSaveClientId = (e) => {
    e.preventDefault();
    if (!inputClientId.trim()) {
      setError('Por favor, cole um Client ID válido (ex: 12345-xxx.apps.googleusercontent.com)');
      return;
    }
    setError(null);
    setActiveClientId(inputClientId.trim());
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div style={{ marginBottom: '1.25rem' }}>
          <img src="/logo-cecate.png" alt="CECATE UFG Logo" style={{ height: '65px', maxWidth: '100%', objectFit: 'contain' }} />
        </div>
        
        <h2 className="auth-title">Automador FNDE</h2>
        <p className="auth-subtitle">
          Autenticação via Google OAuth 2.0 (aceita qualquer e-mail do Google).
        </p>

        <div className="domain-badge">
          <CheckCircle2 size={16} /> Autenticação Oficial Google
        </div>

        {error && (
          <div className="alert alert-error" style={{ textAlign: 'left', marginBottom: '15px' }}>
            <ShieldAlert size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* Se já tiver Client ID ativo, exibe o botão do Google */}
        {activeClientId ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0' }}>
            {loading ? (
              <div className="spinner"></div>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                useOneTap
                theme="filled_blue"
                shape="pill"
                text="signin_with"
              />
            )}
            
            <button 
              type="button" 
              onClick={() => setActiveClientId('')} 
              className="btn btn-outline" 
              style={{ marginTop: '15px', fontSize: '0.78rem', padding: '4px 10px' }}
            >
              Trocar Client ID
            </button>
          </div>
        ) : (
          /* Se não tiver Client ID, exibe campo simples na própria página para o usuário colar */
          <form onSubmit={handleSaveClientId} style={{ marginTop: '15px', textAlign: 'left' }}>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.85rem' }}>
                <Key size={16} color="#F3A712" /> Cole seu Google Client ID para ativar o botão de login:
              </label>
              <input
                type="text"
                className="form-control"
                value={inputClientId}
                onChange={(e) => setInputClientId(e.target.value)}
                placeholder="123456789-abcdef.apps.googleusercontent.com"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Ativar Botão de Login do Google <ArrowRight size={18} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
