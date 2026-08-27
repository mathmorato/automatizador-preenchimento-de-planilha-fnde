import React from 'react';
import { LogOut, ShieldCheck, Download } from 'lucide-react';

export default function Header({ user, onLogout }) {
  const handleDownloadCSV = () => {
    window.open('/api/sheets/export-csv', '_blank');
  };

  return (
    <header className="top-nav">
      <div className="nav-container">
        <a href="/" className="brand-section">
          <img src="./logo-cecate.png" alt="Logo CECATE UFG FNDE" className="brand-logo" />
        </a>

        {user && (
          <div className="nav-controls" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={handleDownloadCSV}
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.82rem', background: '#047857', borderColor: '#047857', color: '#FFF', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              title="Baixar todos os atendimentos salvos em arquivo CSV / Excel"
            >
              <Download size={15} /> Baixar Planilha (CSV)
            </button>

            <div className="user-profile-badge">
              <ShieldCheck size={16} color="#0066B3" />
              <div>
                <div className="user-profile-name">{user.name}</div>
                <div className="user-profile-email">{user.email}</div>
              </div>
            </div>
            
            <button onClick={onLogout} className="btn-logout" title="Sair da sessão">
              <LogOut size={16} /> Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
