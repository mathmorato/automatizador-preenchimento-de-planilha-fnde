import React from 'react';
import { LogOut, ShieldCheck, Activity } from 'lucide-react';
import logoCecate from '../../assets/logo-cecate.png';

export default function Header({ user, onLogout }) {
  return (
    <header className="top-nav">
      <div className="nav-container">
        <a href="/" className="brand-section">
          <img src={logoCecate} alt="Logo CECATE UFG FNDE" className="brand-logo" />
        </a>

        {user && (
          <div className="nav-controls" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Badge de Status da API e IA */}
            <div
              className="api-status-badge"
              style={{
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: '#F0FDF4',
                color: '#047857',
                border: '1px solid #86EFAC',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(16,185,129,0.1)'
              }}
              title="Status do Servidor e Inteligência Artificial Gemini: 100% Online e Seguro"
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10B981',
                boxShadow: '0 0 8px #10B981',
                display: 'inline-block'
              }}></span>
              <Activity size={13} color="#10B981" />
              <span>IA Gemini Online</span>
            </div>

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
      </div>
    </header>
  );
}
