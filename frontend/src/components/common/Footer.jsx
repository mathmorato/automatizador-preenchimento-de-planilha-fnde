import React from 'react';

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <img src="./logo-cecate.png" alt="Logo CECATE UFG" style={{ height: '42px', objectFit: 'contain', opacity: 0.95 }} />
        <p>CECATE Centro-Oeste — Centro Colaborador de Apoio ao Transporte Escolar</p>
        <span>Universidade Federal de Goiás (UFG) &amp; Fundo Nacional de Desenvolvimento da Educação (FNDE)</span>
      </div>
    </footer>
  );
}
