import React, { useState, useEffect } from 'react';
import { LogOut, ShieldCheck, Key, Check } from 'lucide-react';
import logoCecate from '../../assets/logo-cecate.png';

export default function Header({ user, onLogout }) {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const key = localStorage.getItem('GEMINI_API_KEY') || '';
    setApiKey(key);
  }, []);

  const handleSaveKey = () => {
    localStorage.setItem('GEMINI_API_KEY', apiKey.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setShowKeyModal(false);
    }, 1200);
  };

  const hasKey = Boolean(localStorage.getItem('GEMINI_API_KEY'));

  return (
    <header className="top-nav">
      <div className="nav-container">
        <a href="/" className="brand-section">
          <img src={logoCecate} alt="Logo CECATE UFG FNDE" className="brand-logo" />
        </a>

        {user && (
          <div className="nav-controls" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => setShowKeyModal(true)}
              className="btn btn-outline"
              style={{
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: hasKey ? '#F0FDF4' : '#FFFBEB',
                color: hasKey ? '#047857' : '#B45309',
                borderColor: hasKey ? '#86EFAC' : '#FCD34D',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer'
              }}
              title="Configurar Chave de API Gratuita do Google Gemini"
            >
              <Key size={14} />
              {hasKey ? 'Chave IA Ativa' : 'Configurar Chave IA'}
            </button>

            <div className="user-profile-badge" style={{ padding: '4px 10px' }}>
              <ShieldCheck size={15} color="#0066B3" />
              <div>
                <div className="user-profile-name" style={{ fontSize: '0.8rem' }}>{user.name}</div>
                <div className="user-profile-email" style={{ fontSize: '0.7rem' }}>{user.email}</div>
              </div>
            </div>
            
            <button onClick={onLogout} className="btn-logout" title="Sair da sessão" style={{ padding: '5px 10px', fontSize: '0.78rem' }}>
              <LogOut size={15} /> Sair
            </button>
          </div>
        )}

        {/* Modal de Configuração da Chave Gemini */}
        {showKeyModal && (
          <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div className="modal-card" style={{ background: '#FFF', borderRadius: '12px', padding: '24px', maxWidth: '480px', width: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Key size={22} color="#0066B3" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1E293B' }}>Chave de API Gratuita (Google Gemini)</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: '1.4' }}>
                Cole abaixo sua chave gratuita gerada no <strong>Google AI Studio</strong>. O sistema usará a inteligência artificial Gemini Flash para ler conversas e preencher formulários automaticamente com 100% de precisão!
              </p>
              
              <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.78rem', color: '#475569', borderLeft: '4px solid #0066B3' }}>
                💡 <strong>Como obter sua chave 100% grátis:</strong><br />
                1. Acesse: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#0066B3', fontWeight: 700 }}>aistudio.google.com/app/apikey</a><br />
                2. Faça login com sua conta do Google (@gmail.com)<br />
                3. Clique em <strong>"Create API Key"</strong> e cole o código abaixo.
              </div>

              <input
                type="text"
                className="form-control"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginBottom: '16px' }}
                placeholder="Cole sua chave aqui (ex: AIzaSy...)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                  onClick={() => setShowKeyModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem', background: savedSuccess ? '#10B981' : '#0066B3' }}
                  onClick={handleSaveKey}
                >
                  {savedSuccess ? (
                    <>
                      <Check size={16} /> Chave Salva!
                    </>
                  ) : (
                    'Salvar Chave'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
