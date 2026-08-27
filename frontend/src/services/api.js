import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '/api'
    : 'https://automatizador-fnde-api.onrender.com/api'
);

export async function registerUser({ name, email, password }) {
  const response = await axios.post(`${API_BASE}/auth/register`, {
    name,
    email,
    password,
  });
  return response.data;
}

export async function loginUser({ email, password }) {
  const response = await axios.post(`${API_BASE}/auth/login`, {
    email,
    password,
  });
  return response.data;
}

export async function requestForgotPassword({ email }) {
  const response = await axios.post('https://script.google.com/macros/s/AKfycbw4iklk-J8ht-drqJI2VrzsBKO9r7PHnfK5QCl1nYRdzy4FHdA19t9boRoEoQpP3AGQ/exec', {
    email,
  });
  return response.data;
}

export async function resetPassword({ email, code, newPassword }) {
  const response = await axios.post(`${API_BASE}/auth/reset-password`, {
    email,
    code,
    new_password: newPassword,
  });
  return response.data;
}

export async function fetchNextRow(idToken) {
  const response = await axios.get(`${API_BASE}/sheets/next-row`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  return response.data;
}

export async function checkRowStatus(targetRow, idToken) {
  const response = await axios.get(`${API_BASE}/sheets/check-row/${targetRow}`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  return response.data;
}

export async function regenerateAIField({ fieldName, currentValue, rawChatText, userInstruction, assunto, idToken }) {
  const response = await axios.post(
    `${API_BASE}/ai/regenerate-field`,
    {
      field_name: fieldName,
      current_value: currentValue,
      raw_chat_text: rawChatText || '',
      user_instruction: userInstruction || '',
      assunto: assunto || 'SETE',
    },
    {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    }
  );
  return response.data;
}

export async function verifyGoogleToken(token) {
  const response = await axios.post(
    `${API_BASE}/auth/verify-token`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
}

export async function parseChatOrScreenshots({ files, textContent, tecnicoName, customInstructions, idToken }) {
  const formData = new FormData();
  formData.append('tecnico_name', tecnicoName || 'Matheus Morato');
  formData.append('custom_instructions', customInstructions || '');
  formData.append('text_content', textContent || '');

  if (files && files.length > 0) {
    files.forEach((file) => {
      formData.append('files', file);
    });
  }

  const response = await axios.post(`${API_BASE}/parse`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${idToken}`,
    },
  });
  return response.data;
}

export async function insertToSheets(record, targetRow, idToken) {
  const response = await axios.post(
    `${API_BASE}/sheets/append`,
    {
      record,
      target_row: targetRow ? parseInt(targetRow, 10) : null,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    }
  );
  return response.data;
}

export async function fetchTrainingParticipants(municipio, uf, idToken) {
  const response = await axios.get(`${API_BASE}/training/participants`, {
    params: { municipio, uf },
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  return response.data;
}
