import React from 'react';
import logoCecate from '../../assets/logo-cecate.png';

export const APP_VERSION = "v1.4.7";






export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <img src={logoCecate} alt="Logo CECATE UFG" style={{ height: '40px', objectFit: 'contain', opacity: 0.9 }} />
        <p style={{ margin: '4px 0' }}>CECATE Centro-Oeste — Centro Colaborador de Apoio ao Transporte Escolar</p>
        <span style={{ fontSize: '0.78rem', opacity: 0.85 }}>Universidade Federal de Goiás (UFG) &amp; Fundo Nacional de Desenvolvimento da Educação (FNDE)</span>
        
        <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#64748B', fontWeight: 500 }}>
          © {currentYear} CECATE Centro-Oeste • Versão {APP_VERSION}
        </div>
      </div>
    </footer>
  );
}
