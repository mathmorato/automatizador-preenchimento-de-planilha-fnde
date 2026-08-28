import React from 'react';
import { LogOut, ShieldCheck, Download } from 'lucide-react';
import logoCecate from '../../assets/logo-cecate.png';

export default function Header({ user, onLogout }) {
  const handleDownloadCSV = () => {
    window.open('/api/sheets/export-csv', '_blank');
  };

  return (
    <header className="top-nav">
      <div className="nav-container">
        <a href="/" className="brand-section">
          <img src={logoCecate} alt="Logo CECATE UFG FNDE" className="brand-logo" />
        </a>

        {user && (
          <div className="nav-controls" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handleDownloadCSV}
              className="btn btn-primary"
              style={{ padding: '5px 10px', fontSize: '0.78rem', background: '#047857', borderColor: '#047857', color: '#FFF', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}
              title="Baixar todos os atendimentos salvos em arquivo CSV / Excel"
            >
              <Download size={14} /> Baixar CSV
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
      </div>
    </header>
  );
}
