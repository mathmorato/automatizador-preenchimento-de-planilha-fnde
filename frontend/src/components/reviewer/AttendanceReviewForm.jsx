import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertTriangle, FileSpreadsheet, Building2, MapPin, User, Phone, Calendar, HelpCircle, FileText, RefreshCw, Hash, Ban, Edit3, Search, Check, Zap, UserCheck, RotateCw } from 'lucide-react';
import { fetchNextRow, checkRowStatus, regenerateAIField, fetchTrainingParticipants } from '../../services/api';
import municipiosData from '../../data/municipios.json';

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const toStr = (val, fallback = '') => (val !== null && val !== undefined ? String(val) : fallback);

export default function AttendanceReviewForm({ initialData, rawChatText, extractedNames = [], extractedDates = [], idToken, onSubmitToSheets, onCancel }) {
  const [formData, setFormData] = useState({
    cecate_responsavel: toStr(initialData?.cecate_responsavel, 'CECATE CO'),
    iniciativa: toStr(initialData?.iniciativa, 'Município'),
    tecnico: toStr(initialData?.tecnico, 'Matheus Morato'),
    meio_contato: toStr(initialData?.meio_contato, 'Whats App'),
    data_atendimento: toStr(initialData?.data_atendimento, new Date().toLocaleDateString('pt-BR')),
    assunto: toStr(initialData?.assunto, 'SETE'),
    resumo_demanda: toStr(initialData?.resumo_demanda, ''),
    uf: toStr(initialData?.uf, 'GO'),
    municipio: toStr(initialData?.municipio, ''),
    capacitacao_participou: toStr(initialData?.capacitacao_participou, 'Não'),
    capacitacao_local: toStr(initialData?.capacitacao_local, ''),
    capacitacao_data: toStr(initialData?.capacitacao_data, ''),
    atendido_nome: toStr(initialData?.atendido_nome, ''),
    atendido_telefone: toStr(initialData?.atendido_telefone, ''),
    atendido_cargo: toStr(initialData?.atendido_cargo, 'Gestor'),
    municipio_respondeu: toStr(initialData?.municipio_respondeu, 'Sim'),
    situacao: toStr(initialData?.situacao, 'Resolvida'),
    observacoes: toStr(initialData?.observacoes, '')
  });

  // Linha Alvo, Edição Manual e Status
  const [targetRow, setTargetRow] = useState('');
  const [isEditingRow, setIsEditingRow] = useState(false);
  const [rowStatus, setRowStatus] = useState(null); // { is_empty: boolean, target_row: number, preview?: array }
  const [checkingRow, setCheckingRow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Participantes da Capacitação do Município
  const [trainingParticipants, setTrainingParticipants] = useState([]);
  const [selectedParticipantIdx, setSelectedParticipantIdx] = useState('');

  // Nomes Extraídos da Conversa do Chat
  const [chatNames, setChatNames] = useState(extractedNames || []);
  const [chatDates, setChatDates] = useState(extractedDates || []);

  useEffect(() => {
    if (extractedNames && extractedNames.length > 0) {
      setChatNames(extractedNames);
    }
  }, [extractedNames]);

  useEffect(() => {
    if (extractedDates && extractedDates.length > 0) {
      setChatDates(extractedDates);
    }
  }, [extractedDates]);

  // Estados de Regeneração por IA
  const [showPromptResumo, setShowPromptResumo] = useState(false);
  const [promptResumoText, setPromptResumoText] = useState('');
  const [loadingResumo, setLoadingResumo] = useState(false);

  const [showPromptObs, setShowPromptObs] = useState(false);
  const [promptObsText, setPromptObsText] = useState('');
  const [loadingObs, setLoadingObs] = useState(false);

  const [loadingNome, setLoadingNome] = useState(false);

  // Função 1: Verificar se a Linha Específica está Livre
  const verifySpecificRow = useCallback(async (rowToVerify) => {
    const rowVal = rowToVerify || targetRow;
    const candidateRow = parseInt(rowVal, 10);
    if (!candidateRow || candidateRow < 1) {
      setFormError('Informe um número de linha válido (ex: 580).');
      return;
    }

    setCheckingRow(true);
    setFormError(null);
    try {
      const res = await checkRowStatus(candidateRow, idToken);
      if (res.success) {
        setRowStatus({
          target_row: candidateRow,
          is_empty: res.is_empty,
          preview: res.preview
        });

        if (!res.is_empty) {
          const previewText = res.preview?.filter(Boolean).slice(0, 3).join(' • ');
          setFormError(`A Linha ${candidateRow} JÁ CONTÉM DADOS (${previewText || 'Linha ocupada'}). Clique em 'Auto-Buscar Linha Livre' para encontrar uma linha vazia sozinho.`);
        }
      }
    } catch (err) {
      console.warn("Erro ao verificar linha:", err);
      setFormError('Erro ao verificar disponibilidade da linha na planilha.');
    } finally {
      setCheckingRow(false);
    }
  }, [idToken, targetRow]);

  // Função 2: Varredura Totalmente Automática da Próxima Linha Livre
  const autoFindFreeRow = useCallback(async (startRowVal = null) => {
    setCheckingRow(true);
    setFormError(null);
    try {
      let startFrom = 580;
      if (startRowVal) {
        startFrom = parseInt(startRowVal, 10);
      } else if (targetRow) {
        startFrom = parseInt(targetRow, 10);
      } else {
        const resNext = await fetchNextRow(idToken);
        if (resNext.success && resNext.next_row) {
          startFrom = resNext.next_row;
        }
      }

      let candidateRow = startFrom || 580;
      let foundEmpty = false;
      let attempts = 0;

      while (!foundEmpty && attempts < 30) {
        attempts++;
        const res = await checkRowStatus(candidateRow, idToken);
        if (res.success && res.is_empty) {
          foundEmpty = true;
          setTargetRow(candidateRow);
          setRowStatus({
            target_row: candidateRow,
            is_empty: true
          });
          break;
        } else {
          candidateRow++;
        }
      }

      if (!foundEmpty) {
        setTargetRow(candidateRow);
        setRowStatus({
          target_row: candidateRow,
          is_empty: false
        });
        setFormError(`Verificamos até a linha ${candidateRow} e não encontramos linhas vazias.`);
      }
    } catch (err) {
      console.warn("Erro ao buscar linha livre automaticamente:", err);
      setFormError('Erro ao consultar disponibilidade na planilha.');
    } finally {
      setCheckingRow(false);
    }
  }, [idToken, targetRow]);

  // Executa busca automática de linha livre ao carregar a página
  useEffect(() => {
    autoFindFreeRow();
  }, [idToken]);

  // Buscar Pessoas do Município que Participaram da Capacitação
  useEffect(() => {
    let isMounted = true;
    if (formData.municipio && formData.municipio.trim().length >= 3) {
      fetchTrainingParticipants(formData.municipio, formData.uf, idToken)
        .then((res) => {
          if (isMounted && res.success && res.participants && res.participants.length > 0) {
            setTrainingParticipants(res.participants);
          } else if (isMounted) {
            setTrainingParticipants([]);
            setSelectedParticipantIdx('');
          }
        })
        .catch(() => {
          if (isMounted) {
            setTrainingParticipants([]);
            setSelectedParticipantIdx('');
          }
        });
    } else {
      setTrainingParticipants([]);
      setSelectedParticipantIdx('');
    }
    return () => { isMounted = false; };
  }, [formData.municipio, formData.uf, idToken]);

  const handleSelectParticipant = (val) => {
    setSelectedParticipantIdx(val);
    if (val === '' || val === 'none') {
      return;
    }
    const idx = parseInt(val, 10);
    const p = trainingParticipants[idx];
    if (p) {
      setFormData((prev) => ({
        ...prev,
        atendido_nome: p.nome,
        capacitacao_participou: 'Sim',
        capacitacao_local: p.local || prev.capacitacao_local,
        capacitacao_data: p.data || prev.capacitacao_data,
      }));
    }
  };

  // Estado de Validação dos Campos da Conferência
  const [missingFieldKeys, setMissingFieldKeys] = useState([]);

  const validateAllFormFields = () => {
    const errors = [];
    const missingKeys = [];

    if (!formData.tecnico || !formData.tecnico.trim()) {
      errors.push("Técnico do CECATE");
      missingKeys.push("tecnico");
    }
    if (!formData.data_atendimento || !formData.data_atendimento.trim()) {
      errors.push("Data do Atendimento");
      missingKeys.push("data_atendimento");
    }
    if (!formData.assunto || !formData.assunto.trim()) {
      errors.push("Assunto (Programa FNDE)");
      missingKeys.push("assunto");
    }
    if (!formData.resumo_demanda || !formData.resumo_demanda.trim() || formData.resumo_demanda.trim().length < 4) {
      errors.push("Resumo da Demanda (preencha a descrição da dúvida/solicitação)");
      missingKeys.push("resumo_demanda");
    }
    if (!formData.uf || !formData.uf.trim()) {
      errors.push("UF (Estado)");
      missingKeys.push("uf");
    }
    if (!formData.municipio || !formData.municipio.trim() || formData.municipio.trim().toLowerCase() === "município atendido" || formData.municipio.trim().toLowerCase() === "municipio atendido") {
      errors.push("Município (informe o nome da cidade atendida)");
      missingKeys.push("municipio");
    }
    if (!formData.atendido_nome || !formData.atendido_nome.trim()) {
      errors.push("Nome do Atendido");
      missingKeys.push("atendido_nome");
    }
    if (!formData.observacoes || !formData.observacoes.trim()) {
      errors.push("Observações e Encaminhamentos");
      missingKeys.push("observacoes");
    }
    if (!targetRow || parseInt(targetRow, 10) < 1) {
      errors.push("Número da Linha de Destino na Planilha");
      missingKeys.push("targetRow");
    }

    return { errors, missingKeys };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (missingFieldKeys.includes(name)) {
      setMissingFieldKeys((prev) => prev.filter((k) => k !== name));
    }
    if (name === 'capacitacao_participou' && value === 'Não') {
      setSelectedParticipantIdx('');
      setFormData((prev) => ({
        ...prev,
        capacitacao_participou: 'Não',
        capacitacao_local: '',
        capacitacao_data: ''
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Regenerar Nome com IA
  const handleRegenerateNome = async () => {
    setLoadingNome(true);
    setFormError(null);
    try {
      const res = await regenerateAIField({
        fieldName: 'atendido_nome',
        currentValue: formData.atendido_nome,
        rawChatText: rawChatText || formData.observacoes,
        userInstruction: 'Reler a conversa completa e extrair todos os nomes de atendidos/gestores municipais.',
        assunto: formData.assunto,
        idToken
      });
      if (res.success && res.generated_text) {
        setFormData(prev => ({ ...prev, atendido_nome: res.generated_text }));
      }
      if (res.extracted_names && res.extracted_names.length > 0) {
        setChatNames(res.extracted_names);
      }
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Erro ao reinterpretar nome com IA.');
    } finally {
      setLoadingNome(false);
    }
  };

  // Regenerar Resumo com IA
  const handleRegenerateResumo = async (customInstruction = '') => {
    setLoadingResumo(true);
    setFormError(null);
    try {
      const res = await regenerateAIField({
        fieldName: 'resumo_demanda',
        currentValue: formData.resumo_demanda,
        rawChatText: rawChatText || formData.observacoes,
        userInstruction: customInstruction || promptResumoText,
        assunto: formData.assunto,
        idToken
      });
      if (res.success && res.generated_text) {
        setFormData(prev => ({ ...prev, resumo_demanda: res.generated_text }));
        setShowPromptResumo(false);
        setPromptResumoText('');
      }
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Erro ao reinterpretar resumo com IA.');
    } finally {
      setLoadingResumo(false);
    }
  };

  // Regenerar Observações com IA
  const handleRegenerateObs = async (customInstruction = '') => {
    setLoadingObs(true);
    setFormError(null);
    try {
      const res = await regenerateAIField({
        fieldName: 'observacoes',
        currentValue: formData.observacoes,
        rawChatText: rawChatText || formData.observacoes,
        userInstruction: customInstruction || promptObsText,
        assunto: formData.assunto,
        idToken
      });
      if (res.success && res.generated_text) {
        setFormData(prev => ({ ...prev, observacoes: res.generated_text }));
        setShowPromptObs(false);
        setPromptObsText('');
      }
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Erro ao reinterpretar observações com IA.');
    } finally {
      setLoadingObs(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // CONFERÊNCIA OBRIGATÓRIA DE TODOS OS CAMPOS
    const { errors, missingKeys } = validateAllFormFields();
    if (errors.length > 0) {
      setMissingFieldKeys(missingKeys);
      setFormError(
        `CONFERÊNCIA PENDENTE: Por favor, preencha as seguintes informações obrigatórias antes de gravar na planilha:\n• ${errors.join('\n• ')}`
      );

      const panelCard = document.querySelector('.panel-card');
      if (panelCard) {
        panelCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    if (rowStatus && !rowStatus.is_empty) {
      setFormError(`BLOQUEIO DE SEGURANÇA: A Linha ${targetRow} já contém dados na planilha. Clique em 'Auto-Buscar Linha Livre' para encontrar uma linha vazia.`);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitToSheets(formData, targetRow);
    } catch (err) {
      setFormError(err.response?.data?.detail || err.message || 'Erro ao salvar na planilha.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel-card" style={{ borderTop: '4px solid #10B981' }}>
      <div className="panel-title">
        <CheckCircle color="#10B981" size={24} /> Conferência Prévia do Atendimento
      </div>
      <p className="panel-subtitle">
        Confira as informações extraídas da conversa e confirme a gravação na planilha FNDE.
      </p>

      {formError && (
        <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={20} />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="review-grid">
          {/* Sessão 1: Informações Gerais do Atendimento */}
          <div className="section-title">
            <Building2 size={18} /> 1. Dados do Atendimento e Técnico
          </div>

          <div className="form-group">
            <label>CECATE Responsável:</label>
            <input
              type="text"
              name="cecate_responsavel"
              className="form-control"
              value={formData.cecate_responsavel}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Iniciativa do Contato:</label>
            <select
              name="iniciativa"
              className="form-control"
              value={formData.iniciativa}
              onChange={handleChange}
            >
              <option value="Município">Município</option>
              <option value="CECATE">CECATE</option>
            </select>
          </div>

          <div className="form-group">
            <label>Técnico do CECATE:</label>
            <input
              type="text"
              name="tecnico"
              className="form-control"
              value={formData.tecnico}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Meio de Contato:</label>
            <select
              name="meio_contato"
              className="form-control"
              value={formData.meio_contato}
              onChange={handleChange}
            >
              <option value="Whats App">Whats App</option>
              <option value="Ligação">Ligação</option>
              <option value="E-mail">E-mail</option>
              <option value="Vídeo Conferência">Vídeo Conferência</option>
              <option value="Presencial">Presencial</option>
            </select>
          </div>

          <div className="form-group">
            <label><Calendar size={14} /> Data do Atendimento:</label>
            <input
              type="text"
              name="data_atendimento"
              className="form-control"
              value={formData.data_atendimento}
              onChange={handleChange}
              placeholder="DD/MM/AAAA (digite livremente ou selecione abaixo)"
              required
            />

            {chatDates.length > 0 && (
              <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Datas encontradas na conversa (clique para selecionar):
                </span>
                {chatDates.map((dt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    style={{
                      background: formData.data_atendimento === dt ? '#0066B3' : '#F0F9FF',
                      color: formData.data_atendimento === dt ? '#FFF' : '#0066B3',
                      border: '1px solid #BAE6FD',
                      borderRadius: '12px',
                      padding: '3px 10px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={() => setFormData((prev) => ({ ...prev, data_atendimento: dt }))}
                  >
                    <Calendar size={12} /> {dt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sessão 2: Programa e Demanda */}
          <div className="section-title">
            <HelpCircle size={18} /> 2. Assunto e Demanda
          </div>

          <div className="form-group">
            <label>Assunto (Programa FNDE):</label>
            <select
              name="assunto"
              className="form-control"
              value={formData.assunto}
              onChange={handleChange}
            >
              <option value="SETE">SETE</option>
              <option value="PNATE">PNATE</option>
              <option value="Caminho da Escola">Caminho da Escola</option>
            </select>
          </div>

          <div className="form-group full-width">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
              <label style={{ margin: 0, fontWeight: 700 }}>Resumo da Demanda:</label>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ 
                    border: 'none', 
                    background: '#EBF5FF', 
                    color: '#0066B3', 
                    fontSize: '0.78rem', 
                    fontWeight: 700,
                    padding: '4px 10px', 
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  disabled={loadingResumo}
                  onClick={() => handleRegenerateResumo('')}
                >
                  {loadingResumo ? (
                    <div className="spinner" style={{ width: '12px', height: '12px' }}></div>
                  ) : (
                    <>
                      <RotateCw size={13} color="#0066B3" /> Reler Conversa
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn-outline"
                  style={{ 
                    border: 'none', 
                    background: '#F0FDF4', 
                    color: '#047857', 
                    fontSize: '0.78rem', 
                    fontWeight: 700,
                    padding: '4px 10px', 
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  onClick={() => setShowPromptResumo(!showPromptResumo)}
                >
                  <Edit3 size={13} color="#047857" />
                  {showPromptResumo ? 'Fechar' : 'Instruir Refinamento'}
                </button>
              </div>
            </div>

            {/* Barra de Comando para Refinamento (Resumo) */}
            {showPromptResumo && (
              <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', padding: '10px', borderRadius: '8px', marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ background: '#FFF', fontSize: '0.85rem' }}
                  placeholder="Digite a instrução para ajustar o texto (ex: Deixar mais curto, focar na dúvida do SETE...)"
                  value={promptResumoText}
                  onChange={(e) => setPromptResumoText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleRegenerateResumo();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '8px 14px', fontSize: '0.85rem', whiteSpace: 'nowrap', background: '#047857' }}
                  disabled={loadingResumo}
                  onClick={() => handleRegenerateResumo()}
                >
                  {loadingResumo ? (
                    <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                  ) : (
                    <>
                      <RotateCw size={14} /> Aplicar Refinamento
                    </>
                  )}
                </button>
              </div>
            )}

            <input
              type="text"
              name="resumo_demanda"
              className="form-control"
              style={{
                borderColor: missingFieldKeys.includes('resumo_demanda') ? '#EF4444' : undefined,
                boxShadow: missingFieldKeys.includes('resumo_demanda') ? '0 0 0 3px rgba(239, 68, 68, 0.25)' : undefined
              }}
              value={formData.resumo_demanda}
              onChange={handleChange}
              placeholder="Ex: Dúvida sobre atualização do SETE ou prestação de contas"
              required
            />
          </div>

          {/* Sessão 3: Localização do Município */}
          <div className="section-title">
            <MapPin size={18} /> 3. Localização do Município
          </div>

          <div className="form-group">
            <label>UF (Estado):</label>
            <select
              name="uf"
              className="form-control"
              style={{
                borderColor: missingFieldKeys.includes('uf') ? '#EF4444' : undefined,
                boxShadow: missingFieldKeys.includes('uf') ? '0 0 0 3px rgba(239, 68, 68, 0.25)' : undefined
              }}
              value={formData.uf}
              onChange={handleChange}
            >
              {ESTADOS_BRASIL.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Município Atendido ({formData.uf}):</label>
            <select
              name="municipio"
              className="form-control"
              style={{
                borderColor: missingFieldKeys.includes('municipio') ? '#EF4444' : undefined,
                boxShadow: missingFieldKeys.includes('municipio') ? '0 0 0 3px rgba(239, 68, 68, 0.25)' : undefined,
                fontWeight: 600
              }}
              value={formData.municipio}
              onChange={handleChange}
              required
            >
              <option value="">-- Selecione o Município ({formData.uf}) --</option>
              {formData.municipio && !(municipiosData[formData.uf] || []).includes(formData.municipio) && (
                <option value={formData.municipio}>
                  📍 {formData.municipio} (Extraído da Conversa)
                </option>
              )}
              {(municipiosData[formData.uf] || []).map((muni) => (
                <option key={muni} value={muni}>
                  {muni}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Participou de Capacitação?</label>
            <select
              name="capacitacao_participou"
              className="form-control"
              value={formData.capacitacao_participou}
              onChange={handleChange}
            >
              <option value="Não">Não</option>
              <option value="Sim">Sim</option>
            </select>
          </div>

          {formData.capacitacao_participou === 'Sim' && (
            <>
              <div className="form-group">
                <label>Local da Capacitação:</label>
                <input
                  type="text"
                  name="capacitacao_local"
                  className="form-control"
                  value={formData.capacitacao_local}
                  onChange={handleChange}
                  placeholder="Ex: Uruaçu - GO"
                />
              </div>

              <div className="form-group">
                <label>Data da Capacitação:</label>
                <input
                  type="text"
                  name="capacitacao_data"
                  className="form-control"
                  value={formData.capacitacao_data}
                  onChange={handleChange}
                  placeholder="Ex: 15 e 16 de Outubro de 2025"
                />
              </div>
            </>
          )}

          {/* Sessão 4: Contato Atendido */}
          <div className="section-title">
            <User size={18} /> 4. Pessoa Atendida e Capacitações
          </div>

          {/* BANNER DE SELEÇÃO DE PARTICIPANTES DA CAPACITAÇÃO */}
          {trainingParticipants && trainingParticipants.length > 0 && (
            <div 
              className="form-group full-width" 
              style={{ 
                gridColumn: '1 / -1',
                width: '100%',
                background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)', 
                border: '1.5px solid #34D399', 
                padding: '14px 18px', 
                borderRadius: '12px', 
                marginBottom: '10px',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ color: '#065F46', fontWeight: 800, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCheck size={20} color="#059669" />
                  Pessoas que participaram da capacitação em <strong style={{ color: '#047857' }}>{formData.municipio} - {formData.uf}</strong>:
                </div>
                <span style={{ background: '#10B981', color: '#FFF', padding: '2px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800 }}>
                  {trainingParticipants.length} {trainingParticipants.length === 1 ? 'encontrada' : 'encontradas'}
                </span>
              </div>
              
              <select
                className="form-control"
                style={{ 
                  width: '100%',
                  background: '#FFFFFF', 
                  fontWeight: 700, 
                  borderColor: '#10B981', 
                  color: '#065F46', 
                  fontSize: '0.9rem', 
                  cursor: 'pointer',
                  padding: '9px 12px',
                  borderRadius: '8px'
                }}
                value={selectedParticipantIdx}
                onChange={(e) => handleSelectParticipant(e.target.value)}
              >
                <option value="">-- Clique aqui para escolher quem foi atendido (Preenchimento Automático) --</option>
                {trainingParticipants.map((p, idx) => (
                  <option key={idx} value={idx}>
                    👤 {p.nome} ({p.local} • {p.data})
                  </option>
                ))}
                <option value="none">❌ Nenhuma das opções (Outro contato / Digitar Manualmente)</option>
              </select>

              {selectedParticipantIdx !== '' && selectedParticipantIdx !== 'none' && (
                <div style={{ marginTop: '8px', fontSize: '0.84rem', color: '#047857', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={16} color="#059669" /> Dados da capacitação de "{formData.atendido_nome}" vinculados com sucesso!
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ margin: 0, fontWeight: 700 }}>Nome do Atendido:</label>

              <button
                type="button"
                className="btn-outline"
                style={{ 
                  border: 'none', 
                  background: '#EBF5FF', 
                  color: '#0066B3', 
                  fontSize: '0.78rem', 
                  fontWeight: 700,
                  padding: '3px 8px', 
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                disabled={loadingNome}
                onClick={handleRegenerateNome}
              >
                {loadingNome ? (
                  <div className="spinner" style={{ width: '12px', height: '12px' }}></div>
                ) : (
                  <>
                    <Sparkles size={13} color="#0066B3" /> Reler Conversa &amp; Buscar Nome
                  </>
                )}
              </button>
            </div>

            <input
              type="text"
              name="atendido_nome"
              className="form-control"
              style={{
                borderColor: missingFieldKeys.includes('atendido_nome') ? '#EF4444' : undefined,
                boxShadow: missingFieldKeys.includes('atendido_nome') ? '0 0 0 3px rgba(239, 68, 68, 0.25)' : undefined
              }}
              value={formData.atendido_nome}
              onChange={handleChange}
              placeholder="Nome do gestor ou contato (ou digite aqui manualmente)"
            />

            {/* NOMES IDENTIFICADOS NA CONVERSA */}
            {chatNames && chatNames.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0066B3', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={13} color="#0066B3" /> Nomes identificados no texto da conversa (clique para escolher ou digite manualmente acima):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {chatNames.map((name, idx) => (
                    <button
                      key={idx}
                      type="button"
                      style={{
                        background: formData.atendido_nome === name ? '#0066B3' : '#EBF5FF',
                        color: formData.atendido_nome === name ? '#FFFFFF' : '#0066B3',
                        border: formData.atendido_nome === name ? '1px solid #005291' : '1px solid #BFDBFE',
                        padding: '4px 12px',
                        borderRadius: '16px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: formData.atendido_nome === name ? '0 2px 4px rgba(0,102,179,0.25)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                      onClick={() => setFormData(prev => ({ ...prev, atendido_nome: name }))}
                    >
                      👤 {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label><Phone size={14} /> Telefone:</label>
            <input
              type="text"
              name="atendido_telefone"
              className="form-control"
              value={formData.atendido_telefone}
              onChange={handleChange}
              placeholder="(62) 99999-9999"
            />
          </div>

          <div className="form-group">
            <label>Cargo:</label>
            <input
              type="text"
              name="atendido_cargo"
              className="form-control"
              value={formData.atendido_cargo}
              onChange={handleChange}
              placeholder="Gestor / Secretário de Educação / CACs"
            />
          </div>

          <div className="form-group">
            <label>Município Respondeu?</label>
            <select
              name="municipio_respondeu"
              className="form-control"
              value={formData.municipio_respondeu}
              onChange={handleChange}
            >
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
            </select>
          </div>

          {/* Sessão 5: Fechamento & Observações */}
          <div className="section-title">
            <FileText size={18} /> 5. Situação e Observações
          </div>

          <div className="form-group">
            <label>Situação após contato:</label>
            <select
              name="situacao"
              className="form-control"
              value={formData.situacao}
              onChange={handleChange}
              style={{
                borderColor: formData.situacao === 'Resolvida' ? '#10B981' : '#F59E0B',
                fontWeight: 600
              }}
            >
              <option value="Resolvida">Resolvida</option>
              <option value="Pendente">Pendente</option>
            </select>
          </div>

          <div className="form-group full-width" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
              <label style={{ margin: 0, fontWeight: 700 }}>Observações e Encaminhamentos:</label>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ 
                    border: 'none', 
                    background: '#EBF5FF', 
                    color: '#0066B3', 
                    fontSize: '0.78rem', 
                    fontWeight: 700,
                    padding: '4px 10px', 
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  disabled={loadingObs}
                  onClick={() => handleRegenerateObs('')}
                >
                  {loadingObs ? (
                    <div className="spinner" style={{ width: '12px', height: '12px' }}></div>
                  ) : (
                    <>
                      <RotateCw size={13} color="#0066B3" /> Reler Conversa
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn-outline"
                  style={{ 
                    border: 'none', 
                    background: '#F0FDF4', 
                    color: '#047857', 
                    fontSize: '0.78rem', 
                    fontWeight: 700,
                    padding: '4px 10px', 
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  onClick={() => setShowPromptObs(!showPromptObs)}
                >
                  <Edit3 size={13} color="#047857" />
                  {showPromptObs ? 'Fechar' : 'Instruir Refinamento'}
                </button>
              </div>
            </div>

            {/* Barra de Comando para Refinamento (Observações) */}
            {showPromptObs && (
              <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', padding: '10px', borderRadius: '8px', marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ background: '#FFF', fontSize: '0.85rem' }}
                  placeholder="Digite a instrução para ajustar o texto (ex: Detalhar orientação, resumir tópicos, incluir pendência...)"
                  value={promptObsText}
                  onChange={(e) => setPromptObsText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleRegenerateObs();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '8px 14px', fontSize: '0.85rem', whiteSpace: 'nowrap', background: '#047857' }}
                  disabled={loadingObs}
                  onClick={() => handleRegenerateObs()}
                >
                  {loadingObs ? (
                    <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                  ) : (
                    <>
                      <RotateCw size={14} /> Aplicar Refinamento
                    </>
                  )}
                </button>
              </div>
            )}

            <textarea
              name="observacoes"
              className="form-control"
              rows="4"
              value={formData.observacoes}
              onChange={handleChange}
              placeholder="Digite todos os detalhes da orientação ou pendência..."
            />
          </div>
        </div>

        {/* SEÇÃO DA LINHA DE DESTINO COM OS 3 BOTÕES SEPARADOS: 'VERIFICAR LINHA', 'AUTO-BUSCAR LINHA LIVRE' E 'DIGITAR MANUALMENTE' */}
        <div 
          style={{
            background: '#F0F9FF',
            border: '2px solid #0066B3',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginTop: '1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxWidth: '100%',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <label style={{ fontWeight: 800, color: '#0066B3', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
              <Hash size={22} color="#0066B3" /> Número da Linha de Destino na Planilha FNDE:
            </label>

            <div className="row-buttons-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Campo de Número da Linha */}
              <input
                type="number"
                min="1"
                className="form-control target-row-input"
                style={{ 
                  width: '100px', 
                  fontWeight: 800, 
                  fontSize: '1.1rem', 
                  textAlign: 'center', 
                  borderColor: isEditingRow ? '#F59E0B' : '#0066B3',
                  background: isEditingRow ? '#FEF3C7' : '#FFFFFF',
                  color: isEditingRow ? '#92400E' : '#000000'
                }}
                value={targetRow}
                disabled={!isEditingRow}
                onChange={(e) => {
                  setTargetRow(e.target.value);
                  setRowStatus(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setIsEditingRow(false);
                    verifySpecificRow(e.target.value);
                  }
                }}
                placeholder="Ex: 580"
                required
              />

              {/* BOTÃO 1: VERIFICAR LINHA ESPECÍFICA */}
              <button
                type="button"
                onClick={() => {
                  setIsEditingRow(false);
                  verifySpecificRow(targetRow);
                }}
                className="btn btn-primary btn-row-action"
                disabled={checkingRow}
                style={{ padding: '9px 14px', background: '#0066B3', color: '#FFF', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {checkingRow ? (
                  <>
                    <div className="spinner" style={{ width: '14px', height: '14px' }}></div> Verificando...
                  </>
                ) : (
                  <>
                    <Search size={16} /> Verificar Linha
                  </>
                )}
              </button>

              {/* BOTÃO 2: AUTO-BUSCAR PRÓXIMA LINHA LIVRE (AUTOMÁTICO) */}
              <button
                type="button"
                onClick={() => {
                  setIsEditingRow(false);
                  autoFindFreeRow();
                }}
                className="btn btn-primary btn-row-action"
                disabled={checkingRow}
                style={{ padding: '9px 14px', background: '#047857', color: '#FFF', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Zap size={16} color="#F3A712" /> Auto-Buscar Linha Livre (Automático)
              </button>

              {/* BOTÃO 3: DIGITAR MANUALMENTE */}
              {!isEditingRow ? (
                <button
                  type="button"
                  onClick={() => setIsEditingRow(true)}
                  className="btn btn-outline btn-row-action"
                  style={{ padding: '9px 14px', borderColor: '#D97706', color: '#D97706', background: '#FFFBEB', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Edit3 size={16} /> Digitar Manualmente
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingRow(false);
                    verifySpecificRow(targetRow);
                  }}
                  className="btn btn-primary btn-row-action"
                  style={{ padding: '9px 14px', background: '#10B981', borderColor: '#10B981', color: '#FFF', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={16} /> Validar Digitada
                </button>
              )}
            </div>
          </div>

          {/* Indicador de Status da Linha Alvo Verificada */}
          {rowStatus && (
            <div style={{ maxWidth: '100%', overflow: 'hidden' }}>
              {rowStatus.is_empty ? (
                <div className="alert alert-success" style={{ margin: 0, padding: '12px 14px', fontSize: '0.88rem', lineHeight: '1.4' }}>
                  <CheckCircle size={20} style={{ flexShrink: 0 }} />
                  <div>
                    Linha <strong>{rowStatus.target_row}</strong> foi <strong>VERIFICADA</strong>: 100% VAZIA na aba <em>'Atendimento aos entes'</em> e pronta para gravação!
                  </div>
                </div>
              ) : (
                <div className="alert alert-error" style={{ margin: 0, padding: '12px 14px', fontSize: '0.88rem', lineHeight: '1.4' }}>
                  <Ban size={20} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>ATENÇÃO - LINHA {rowStatus.target_row} JÁ POSSUI DADOS:</strong> {rowStatus.preview?.filter(Boolean).slice(0, 3).join(' • ') || 'Linha Ocupada'}. Clique no botão <strong>'Auto-Buscar Linha Livre'</strong> para o sistema encontrar uma linha vazia sozinho.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '15px', fontSize: '0.82rem', color: '#047857', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <BrainCircuit size={16} />
          <span><strong>Aprendizado Contínuo Ativo:</strong> Ao confirmar a gravação, a IA aprende com as suas edições para aprimorar os próximos atendimentos da equipe!</span>
        </div>

        <div className="actions-row">
          <button type="button" onClick={onCancel} className="btn btn-outline" disabled={submitting}>
            Descartar / Cancelar
          </button>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{
              background: (rowStatus && !rowStatus.is_empty) ? '#CBD5E1' : 'var(--cecate-yellow)',
              color: (rowStatus && !rowStatus.is_empty) ? '#64748B' : '#000',
              borderColor: (rowStatus && !rowStatus.is_empty) ? '#CBD5E1' : 'var(--cecate-yellow)',
              fontSize: '1rem',
              padding: '12px 24px'
            }}
            disabled={submitting || (rowStatus && !rowStatus.is_empty)}
          >
            {submitting ? (
              <>
                <div className="spinner"></div> Gravando na Linha {targetRow}...
              </>
            ) : (
              <>
                <FileSpreadsheet size={18} /> Confirmar &amp; Inserir na Linha {targetRow || ''} da Planilha
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
