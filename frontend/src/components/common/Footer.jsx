import React from 'react';
import logoCecate from '../../assets/logo-cecate.png';

export const APP_VERSION = "v1.1.3";

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <img src={logoCecate} alt="Logo CECATE UFG" style={{ height: '42px', objectFit: 'contain', opacity: 0.95 }} />
        <p style={{ margin: '4px 0' }}>CECATE Centro-Oeste — Centro Colaborador de Apoio ao Transporte Escolar</p>
        <span style={{ fontSize: '0.78rem', opacity: 0.85 }}>Universidade Federal de Goiás (UFG) &amp; Fundo Nacional de Desenvolvimento da Educação (FNDE)</span>
        
        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span 
            className="version-badge" 
            style={{
              background: 'linear-gradient(135deg, #0066B3 0%, #004B87 100%)',
              color: '#FFFFFF',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '3px 12px',
              borderRadius: '20px',
              letterSpacing: '0.5px',
              boxShadow: '0 2px 8px rgba(0, 102, 179, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            ⚡ Sistema FNDE Automatizado — Versão {APP_VERSION}
          </span>
        </div>
      </div>
    </footer>
  );
}
