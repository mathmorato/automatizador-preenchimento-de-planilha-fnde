import React from 'react';
import { CheckCircle2, ShieldCheck, FileSpreadsheet, RotateCcw } from 'lucide-react';

export default function InsertionConfirmationModal({ data, onConfirmOk, onRetry }) {
  if (!data) return null;

  const record = data.record || {};
  const insertedRow = data.insertedRow || data.data?.inserted_row || '580';

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justify: 'center',
        padding: '0.75rem'
      }}
    >
      <div 
        style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          maxWidth: '580px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Cabeçalho do Modal */}
        <div 
          style={{
            background: 'linear-gradient(135deg, #0066B3 0%, #004B87 100%)',
            color: '#FFFFFF',
            padding: '0.85rem 1.15rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexShrink: 0
          }}
        >
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px', borderRadius: '50%', display: 'flex', flexShrink: 0 }}>
            <ShieldCheck size={24} color="#FFF" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', fontSize: '1.15rem', color: '#FFF', lineHeight: 1.2 }}>
              Inserção na Planilha FNDE
            </h3>
            <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.9, marginTop: '2px' }}>
              Aba <em>'Atendimento aos entes'</em> (GID 1401168846)
            </p>
          </div>
        </div>

        <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
          {/* Badge de Verificação de Sucesso */}
          <div 
            style={{
              background: '#ECFDF5',
              border: '1.5px solid #10B981',
              borderRadius: '8px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '0.85rem',
              color: '#065F46'
            }}
          >
            <CheckCircle2 size={22} color="#10B981" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '0.92rem' }}>REGISTRO CONFERIDO E GRAVADO COM SUCESSO!</strong>
              <div style={{ fontSize: '0.82rem', marginTop: '2px' }}>
                O atendimento foi inserido na <strong>Linha {insertedRow}</strong> da planilha do Google Sheets.
              </div>
            </div>
          </div>

          {/* Resumo dos Dados Inseridos */}
          <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '0.85rem 1rem', border: '1px solid #E2E8F0', marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileSpreadsheet size={15} color="#0066B3" /> Dados Conferidos da Linha {insertedRow}:
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px 12px', fontSize: '0.82rem' }}>
              <div>
                <strong>Linha Alvo:</strong> Linha {insertedRow}
              </div>
              <div>
                <strong>Município / UF:</strong> {record.municipio || ''} - {record.uf || ''}
              </div>
              <div>
                <strong>Técnico:</strong> {record.tecnico || ''}
              </div>
              <div>
                <strong>Assunto:</strong> {record.assunto || 'SETE'}
              </div>
              <div>
                <strong>Data:</strong> {record.data_atendimento || ''}
              </div>
              <div>
                <strong>Atendido:</strong> {record.atendido_nome || ''}
              </div>
              <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                <strong>Resumo da Demanda:</strong> {record.resumo_demanda || ''}
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '0.75rem' }}>
            <button
              type="button"
              onClick={onConfirmOk}
              className="btn btn-primary"
              style={{ background: '#10B981', borderColor: '#10B981', color: '#FFF', padding: '12px 18px', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', borderRadius: '8px' }}
            >
              <CheckCircle2 size={20} /> Processar Novo Atendimento (Ok)
            </button>

            <button
              type="button"
              onClick={onRetry}
              className="btn btn-outline"
              style={{ borderColor: '#FCA5A5', color: '#DC2626', background: '#FEF2F2', padding: '8px 12px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', borderRadius: '8px' }}
            >
              <RotateCcw size={14} /> Houve Algum Erro? Refazer Inserção
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
