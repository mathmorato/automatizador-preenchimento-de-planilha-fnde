import React, { useState } from 'react';
import { Upload, FileText, Image as ImageIcon, Sparkles, UserCheck, MessageSquareText } from 'lucide-react';

export default function ChatUploader({ loggedUser, onParseStart, onParseSuccess, onError }) {
  const [files, setFiles] = useState([]);
  const [tecnicoName, setTecnicoName] = useState(loggedUser?.name || 'Matheus Morato');
  const [customText, setCustomText] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selected]);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = Array.from(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...dropped]);
    }
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0 && !customText.trim()) {
      if (onError) onError('Por favor, adicione ao menos um print/imagem, arquivo ZIP ou cole o texto da conversa.');
      return;
    }

    setLoading(true);
    if (onParseStart) onParseStart();

    try {
      await onParseSuccess({ files, textContent: customText, tecnicoName });
    } catch (err) {
      if (onError) onError(err.message || 'Erro ao processar conversa com a IA.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel-card">
      <div className="panel-title">
        <Sparkles color="#F3A712" size={22} /> Envio de Conversa ou Capturas de Tela (WhatsApp)
      </div>
      <p className="panel-subtitle">
        Envie os prints do atendimento ou o arquivo exportado (.zip / .txt) do WhatsApp para a Inteligência Artificial extrair os dados.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="review-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label>
              <UserCheck size={16} color="#0066B3" /> Técnico Responsável pelo Atendimento:
            </label>
            <input
              type="text"
              className="form-control"
              value={tecnicoName}
              onChange={(e) => setTecnicoName(e.target.value)}
              placeholder="Nome do técnico"
              required
            />
          </div>
        </div>

        <div
          className={`dropzone ${dragActive ? 'active' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="dropzone-icon" />
          <h3 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--dark-navy)', fontSize: '1.15rem' }}>
            Arraste e solte os prints ou arquivo de chat aqui
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Formatos suportados: PNG, JPG, WEBP (prints) ou arquivos .ZIP / .TXT exportados do WhatsApp
          </p>

          <label htmlFor="file-upload" className="btn btn-secondary" style={{ display: 'inline-flex', marginTop: '1.25rem' }}>
            Selecionar Arquivos
          </label>
          <input
            id="file-upload"
            type="file"
            multiple
            accept="image/*,.zip,.txt"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {files.length > 0 && (
          <div className="file-preview-list">
            {files.map((file, idx) => (
              <div key={idx} className="file-chip">
                {file.name.endsWith('.zip') || file.name.endsWith('.txt') ? (
                  <FileText size={16} color="#0066B3" />
                ) : (
                  <ImageIcon size={16} color="#047857" />
                )}
                <span>{file.name}</span>
                <button type="button" onClick={() => removeFile(idx)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="form-group full-width" style={{ marginTop: '1.25rem' }}>
          <label>
            <MessageSquareText size={16} color="#0066B3" /> Ou cole o texto da conversa diretamente (opcional):
          </label>
          <textarea
            className="form-control"
            rows="3"
            placeholder="[14/01/2026 10:15] Gestor: Olá, gostaria de tirar uma dúvida sobre a prestação de contas do PNATE..."
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
          />
        </div>

        <div className="actions-row">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner"></div> Analisando Conversa com IA...
              </>
            ) : (
              <>
                <Sparkles size={18} /> Processar com Inteligência Artificial
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
