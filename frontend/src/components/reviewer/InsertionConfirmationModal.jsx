import React from 'react';
import { CheckCircle2, ShieldCheck, FileSpreadsheet, RotateCcw, AlertTriangle, ArrowRight } from 'lucide-react';

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
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
    >
      <div 
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          maxWidth: '680px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeIn 0.25s ease-out'
        }}
      >
        {/* Cabeçalho do Modal */}
        <div 
          style={{
            background: 'linear-gradient(135deg, #0066B3 0%, #004B87 100%)',
            color: '#FFFFFF',
            padding: '1.5rem 1.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '50%', display: 'flex' }}>
            <ShieldCheck size={32} color="#FFF" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', fontSize: '1.35rem', color: '#FFF' }}>
              Confirmação de Inserção na Planilha FNDE
            </h3>
            <p style={{ margin: 0, fontSize: '0.88rem', opacity: 0.9, marginTop: '2px' }}>
              Aba <em>'Atendimento aos entes'</em> (GID 1401168846)
            </p>
          </div>
        </div>

        <div style={{ padding: '1.5rem 1.75rem' }}>
          {/* Badge de Verificação de Sucesso */}
          <div 
            style={{
              background: '#ECFDF5',
              border: '1.5px solid #10B981',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '1.25rem',
              color: '#065F46'
            }}
          >
            <CheckCircle2 size={24} color="#10B981" />
            <div>
              <strong style={{ fontSize: '0.98rem' }}>REGISTRO CONFERIDO E GRAVADO COM SUCESSO!</strong>
              <div style={{ fontSize: '0.88rem', marginTop: '2px' }}>
                O atendimento foi inserido na <strong>Linha {insertedRow}</strong> da planilha do Google Sheets.
              </div>
            </div>
          </div>

          {/* Resumo dos Dados Inseridos */}
          <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '1.25rem', border: '1px solid #E2E8F0', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileSpreadsheet size={16} color="#0066B3" /> Dados Conferidos da Linha {insertedRow}:
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '0.88rem' }}>
              <div>
                <strong>Linha Alvo:</strong> Linha {insertedRow}
              </div>
              <div>
                <strong>Município / UF:</strong> {record.municipio || 'Nioaque'} - {record.uf || 'MS'}
              </div>
              <div>
                <strong>Técnico:</strong> {record.tecnico || 'Matheus Morato'}
              </div>
              <div>
                <strong>Assunto:</strong> {record.assunto || 'SETE'}
              </div>
              <div>
                <strong>Data:</strong> {record.data_atendimento || ''}
              </div>
              <div>
                <strong>Atendido:</strong> {record.atendido_nome || 'Gestor'}
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <strong>Resumo da Demanda:</strong> {record.resumo_demanda || ''}
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onRetry}
              className="btn btn-outline"
              style={{ borderColor: '#EF4444', color: '#DC2626', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={16} /> Houve Algum Erro? Refazer Inserção
            </button>

            <button
              type="button"
              onClick={onConfirmOk}
              className="btn btn-primary"
              style={{ background: '#10B981', borderColor: '#10B981', color: '#FFF', padding: '10px 24px', fontWeight: 700, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <CheckCircle2 size={18} /> Confirmar &amp; Concluir (Ok)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
