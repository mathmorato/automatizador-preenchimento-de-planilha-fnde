import React, { useState, useEffect } from 'react';
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import LoginRegisterCard from './components/auth/LoginRegisterCard';
import ChatUploader from './components/uploader/ChatUploader';
import AttendanceReviewForm from './components/reviewer/AttendanceReviewForm';
import InsertionConfirmationModal from './components/reviewer/InsertionConfirmationModal';
import { parseChatOrScreenshots, insertToSheets } from './services/api';
import { supabase } from './services/supabaseClient';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [idToken, setIdToken] = useState('');

  const [parsedRecord, setParsedRecord] = useState(null);
  const [rawChatText, setRawChatText] = useState('');
  const [extractedNames, setExtractedNames] = useState([]);
  const [extractedDates, setExtractedDates] = useState([]);
  const [confirmationData, setConfirmationData] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Escutar sessões ativas e retornos do Google OAuth do Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const formattedUser = {
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário Google',
          email: session.user.email,
        };
        setUser(formattedUser);
        setIdToken(session.access_token || btoa(JSON.stringify(formattedUser)));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const formattedUser = {
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário Google',
          email: session.user.email,
        };
        setUser(formattedUser);
        setIdToken(session.access_token || btoa(JSON.stringify(formattedUser)));
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIdToken('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLoginSuccess = (userData, token) => {
    const formattedUser = {
      id: userData?.id || 1,
      name: userData?.name || userData?.user_metadata?.full_name || userData?.user_metadata?.name || userData?.email?.split('@')[0] || 'Matheus Morato',
      email: userData?.email || 'matheus.morato1997@gmail.com',
    };
    setUser(formattedUser);
    setIdToken(token || btoa(JSON.stringify(formattedUser)));
    setError(null);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("SignOut Supabase:", e);
    }
    setUser(null);
    setIdToken('');
    setParsedRecord(null);
    setRawChatText('');
    setExtractedNames([]);
    setExtractedDates([]);
    setConfirmationData(null);
    setError(null);
    setSuccessMsg(null);
  };

  const handleParseSuccess = async ({ files, textContent, tecnicoName }) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const response = await parseChatOrScreenshots({
        files,
        textContent,
        tecnicoName,
        idToken,
      });

      if (response.success && response.record) {
        setParsedRecord(response.record);
        setExtractedNames(response.extracted_names || []);
        setExtractedDates(response.extracted_dates || []);
        setRawChatText(response.raw_chat_text || textContent || '');
      } else {
        setError(response.error || 'Não foi possível extrair os dados da conversa.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Erro ao conectar ao servidor backend.');
    }
  };

  const handleSubmitToSheets = async (finalRecord, targetRow) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await insertToSheets(finalRecord, targetRow, idToken);
      if (res.success) {
        setConfirmationData({
          record: finalRecord,
          insertedRow: targetRow || res.data?.inserted_row,
          data: res.data
        });
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Erro ao enviar para o Google Sheets.');
    }
  };

  const handleConfirmModalOk = () => {
    if (confirmationData) {
      const row = confirmationData.insertedRow;
      const muni = confirmationData.record?.municipio;
      const uf = confirmationData.record?.uf;
      setSuccessMsg(`Atendimento registrado com sucesso na Linha ${row}! (${muni} - ${uf})`);
    }
    setConfirmationData(null);
    setParsedRecord(null);
    setRawChatText('');
    setExtractedNames([]);
    setExtractedDates([]);
  };

  const handleRetryModal = () => {
    setConfirmationData(null);
    setError('Você optou por refazer a inserção. Ajuste o número da linha ou as informações e clique em gravar novamente.');
  };

  return (
    <>
      <Header user={user} onLogout={handleLogout} />

      <main className="main-wrapper">
        {!user ? (
          <LoginRegisterCard onLoginSuccess={handleLoginSuccess} />
        ) : (
          <div>
            {error && (
              <div className="alert alert-error">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="alert alert-success">
                <CheckCircle2 size={20} />
                <span>{successMsg}</span>
              </div>
            )}

            {!parsedRecord ? (
              <ChatUploader
                loggedUser={user}
                onParseStart={() => {
                  setError(null);
                  setSuccessMsg(null);
                }}
                onParseSuccess={handleParseSuccess}
                onError={(msg) => setError(msg)}
              />
            ) : (
              <AttendanceReviewForm
                initialData={parsedRecord}
                rawChatText={rawChatText}
                extractedNames={extractedNames}
                extractedDates={extractedDates}
                idToken={idToken}
                onSubmitToSheets={handleSubmitToSheets}
                onCancel={() => {
                  setParsedRecord(null);
                  setRawChatText('');
                  setExtractedNames([]);
                  setExtractedDates([]);
                }}
              />
            )}
          </div>
        )}
      </main>

      {/* Modal de Confirmação e Verificação da Inserção */}
      {confirmationData && (
        <InsertionConfirmationModal
          data={confirmationData}
          onConfirmOk={handleConfirmModalOk}
          onRetry={handleRetryModal}
        />
      )}

      <Footer />
    </>
  );
}
