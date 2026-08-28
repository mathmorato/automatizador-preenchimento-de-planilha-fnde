import JSZip from 'jszip';

const TRAINING_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1CAZBdzN_Wz_z-XM1vrhKTtCcE3PNuTSd8QW9b5cC3Pk/export?format=csv&gid=943666845";
const LIVE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1lQyVlaZOyem8F7SaaeRSpgx1JOTQVRzg7XawseG3TgQ/export?format=csv&gid=1401168846";

const ESTADOS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

let cachedTrainingRecords = null;
let cachedNextRow = 580;

function toTitleCase(str) {
  if (!str) return "";
  const stopwords = ["de", "da", "do", "dos", "das", "e"];
  return str.toLowerCase().split(/\s+/).map((word, index) => {
    if (index > 0 && stopwords.includes(word)) {
      return word;
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

function normalizeText(text) {
  if (!text) return "";
  let str = text.toUpperCase();
  const replacements = {
    'Á': 'A', 'À': 'A', 'Â': 'A', 'Ã': 'A',
    'É': 'E', 'Ê': 'E',
    'Í': 'I',
    'Ó': 'O', 'Ô': 'O', 'Õ': 'O',
    'Ú': 'U', 'Ü': 'U',
    'Ç': 'C'
  };
  for (const [orig, rep] of Object.entries(replacements)) {
    str = str.replaceAll(orig, rep);
  }
  return str.replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function parseCSVLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result.map(s => s.trim().replace(/^"|"$/g, ''));
}

export async function fetchLiveNextRow() {
  try {
    const resp = await fetch(LIVE_SHEET_CSV_URL);
    if (resp.ok) {
      const text = await resp.text();
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      if (lines.length > 0) {
        cachedNextRow = lines.length + 1;
        return cachedNextRow;
      }
    }
  } catch (e) {
    console.warn("Aviso ao buscar próxima linha ao vivo:", e);
  }
  return cachedNextRow;
}

export async function fetchTrainingDatabase() {
  if (cachedTrainingRecords) return cachedTrainingRecords;
  try {
    const resp = await fetch(TRAINING_SHEET_CSV_URL);
    if (!resp.ok) return [];
    const text = await resp.text();
    const lines = text.split('\n');
    const records = [];
    let headerFound = false;

    for (const rawLine of lines) {
      if (!rawLine.trim()) continue;
      const row = parseCSVLine(rawLine);
      if (row.length < 8) continue;

      const rowStr = row.join(' ').toUpperCase();
      if (rowStr.includes("MUNICÍPIO CONVIDADO") || rowStr.includes("ESTADO")) {
        headerFound = true;
        continue;
      }
      if (!headerFound) continue;

      const uf = row[1] ? row[1].trim().toUpperCase() : "";
      const local = row[2] ? row[2].trim() : "";
      const ano = row[3] ? row[3].trim() : "";
      const dataFormacao = row[4] ? row[4].trim() : "";
      const muniConvidado = row[6] ? row[6].trim() : "";
      const participou = row[7] ? row[7].trim().toUpperCase() : "";
      const nomeParticipant = row[8] ? row[8].trim() : "";
      const cpfParticipant = row[9] ? row[9].trim() : "";

      records.push({
        uf,
        local,
        ano,
        data_formacao: dataFormacao,
        municipio: muniConvidado,
        municipio_norm: normalizeText(muniConvidado),
        participou: participou.includes("SIM"),
        nome: nomeParticipant,
        nome_norm: normalizeText(nomeParticipant),
        cpf: cpfParticipant
      });
    }

    cachedTrainingRecords = records;
    return records;
  } catch (e) {
    console.warn("Aviso ao carregar banco de capacitações online:", e);
    return [];
  }
}

export async function lookupTrainingInfo(municipio, uf = "", personName = "") {
  const muniNorm = normalizeText(municipio);
  const ufNorm = (uf || "").trim().toUpperCase();
  const personNorm = normalizeText(personName);

  if (!muniNorm || muniNorm === "MUNICIPIO ATENDIDO" || muniNorm === "MUNICIPIO") {
    return { capacitacao_participou: "Não", capacitacao_local: "", capacitacao_data: "", nome_participante: "", cpf: "" };
  }

  const records = await fetchTrainingDatabase();
  if (!records || records.length === 0) {
    return { capacitacao_participou: "Não", capacitacao_local: "", capacitacao_data: "", nome_participante: "", cpf: "" };
  }

  let matches = records.filter(r => r.participou && r.municipio_norm === muniNorm && (!ufNorm || r.uf === ufNorm));

  if (matches.length === 0) {
    matches = records.filter(r => r.participou && (muniNorm.includes(r.municipio_norm) || r.municipio_norm.includes(muniNorm)) && (!ufNorm || r.uf === ufNorm));
  }

  if (matches.length > 0) {
    let bestMatch = matches[0];
    if (personNorm) {
      for (const m of matches) {
        if (personNorm.includes(m.nome_norm) || m.nome_norm.includes(personNorm)) {
          bestMatch = m;
          break;
        }
      }
    }

    let localFormatted = toTitleCase(bestMatch.local);
    let dataFormatted = bestMatch.data_formacao;

    return {
      capacitacao_participou: "Sim",
      capacitacao_local: localFormatted,
      capacitacao_data: dataFormatted,
      nome_participante: toTitleCase(bestMatch.nome),
      cpf: bestMatch.cpf
    };
  }

  return { capacitacao_participou: "Não", capacitacao_local: "", capacitacao_data: "", nome_participante: "", cpf: "" };
}

export async function getTrainingParticipantsForMunicipio(municipio, uf = "") {
  const muniNorm = normalizeText(municipio);
  if (!muniNorm || muniNorm === "MUNICIPIO ATENDIDO") return [];

  const records = await fetchTrainingDatabase();
  const matches = [];
  const seenNames = new Set();

  for (const r of records) {
    if (r.participou && r.nome) {
      const rowMuni = r.municipio_norm;
      if (rowMuni === muniNorm || (muniNorm.length >= 4 && rowMuni.includes(muniNorm)) || (rowMuni.length >= 4 && muniNorm.includes(rowMuni))) {
        const nomeClean = toTitleCase(r.nome);
        if (!seenNames.has(nomeClean)) {
          seenNames.add(nomeClean);
          let localFormatted = toTitleCase(r.local);
          let dataFormatted = r.data_formacao;
          matches.push({
            nome: nomeClean,
            cpf: r.cpf,
            municipio: toTitleCase(r.municipio),
            uf: r.uf,
            local: localFormatted,
            data: dataFormatted
          });
        }
      }
    }
  }

  return matches;
}

export async function extractZipContent(file) {
  let text = '';
  try {
    const zip = await JSZip.loadAsync(file);
    const txtFiles = Object.keys(zip.files).filter(name => name.endsWith('.txt'));
    if (txtFiles.length > 0) {
      const mainTxt = txtFiles.find(name => name.toLowerCase().includes('_chat')) || txtFiles[0];
      text = await zip.files[mainTxt].async('text');
    }
  } catch (e) {
    console.warn("Erro ao extrair zip no navegador:", e);
  }
  return { text };
}

export function extractPersonName(text, tecnicoName = "") {
  if (!text) return "Gestor Municipal";

  const patternIntro = /(?:meu\s+nome\s+[ée]|me\s+chamo|sou\s+a|sou\s+o|aqui\s+[ée]\s+a|aqui\s+[ée]\s+o)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?)/i;
  const matchIntro = text.match(patternIntro);
  if (matchIntro && matchIntro[1]) {
    const name = matchIntro[1].trim();
    const noise = ["gestor", "secretário", "secretaria", "diretor", "técnico", "tecnico", "professor", "professora"];
    if (!noise.includes(name.toLowerCase()) && name.length > 2) {
      return toTitleCase(name);
    }
  }

  const senders = text.match(/\]\s*([^:\n]+):/g) || [];
  const techKeywords = ["cecate", "suporte", "matheus", "willer", "marcos", "lara", "kariny", "dheovanna", "técnico", "tecnico"];
  if (tecnicoName) techKeywords.push(tecnicoName.toLowerCase());

  for (const s of senders) {
    const clean = s.replace(/\]\s*/, '').replace(':', '').trim();
    const isPhone = /^\+?\d+|\d{4,}/.test(clean);
    const isTech = techKeywords.some(tk => clean.toLowerCase().includes(tk));
    if (!isPhone && !isTech && clean.length > 2 && clean.length < 40) {
      return toTitleCase(clean);
    }
  }

  return "Gestor Municipal";
}

export function extractAllPersonNames(text, tecnicoName = "") {
  if (!text) return [];
  const names = [];
  const senders = text.match(/\]\s*([^:\n]+):/g) || [];
  const techKeywords = ["cecate", "suporte", "matheus", "willer", "marcos", "lara", "kariny", "dheovanna", "técnico", "tecnico", "admin", "fnde"];
  if (tecnicoName) techKeywords.push(tecnicoName.toLowerCase());

  for (const s of senders) {
    const clean = s.replace(/\]\s*/, '').replace(':', '').trim();
    const isPhone = /^\+?\d+|\d{4,}/.test(clean);
    const isTech = techKeywords.some(tk => clean.toLowerCase().includes(tk));
    if (!isPhone && !isTech && clean.length > 2 && clean.length < 40) {
      names.push(toTitleCase(clean));
    }
  }

  const introMatches = text.matchAll(/(?:meu\s+nome\s+[ée]|me\s+chamo|sou\s+a|sou\s+o)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?)/gi);
  for (const m of introMatches) {
    if (m[1] && m[1].trim().length > 2) {
      names.push(toTitleCase(m[1].trim()));
    }
  }

  return Array.from(new Set(names));
}

export function extractAllDatesFromChat(text) {
  if (!text) return [new Date().toLocaleDateString('pt-BR')];
  const matches = text.match(/\b\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}\b/g) || [];
  const unique = Array.from(new Set(matches));
  return unique.length > 0 ? unique : [new Date().toLocaleDateString('pt-BR')];
}

export function extractPhone(text) {
  if (!text) return "";
  const match = text.match(/(\+?\d{2,3}\s?)?(\(?\d{2}\)?\s?)(\d{4,5}[-\s]?\d{4})/);
  if (match) {
    const clean = match[0].replace(/[^\d]/g, '');
    if (clean.length >= 10 && clean.length <= 11) {
      const ddd = clean.slice(0, 2);
      const part1 = clean.length === 11 ? clean.slice(2, 7) : clean.slice(2, 6);
      const part2 = clean.length === 11 ? clean.slice(7) : clean.slice(6);
      return `(${ddd}) ${part1}-${part2}`;
    }
    return match[0].trim();
  }
  return "";
}

export async function parseChatClientSide({ files, textContent, tecnicoName }) {
  let combinedText = textContent || "";

  if (files && files.length > 0) {
    for (const file of files) {
      if (file.name.endsWith('.zip')) {
        const { text } = await extractZipContent(file);
        combinedText += `\n${text}`;
      } else if (file.name.endsWith('.txt')) {
        const txt = await file.text();
        combinedText += `\n${txt}`;
      }
    }
  }

  // 1. Data do atendimento
  const todayStr = new Date().toLocaleDateString('pt-BR');
  let dataAtendimento = todayStr;
  const dateMatch = combinedText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  if (dateMatch) {
    dataAtendimento = dateMatch[1];
  }

  // 2. Assunto
  let assunto = "SETE";
  if (/pnate/i.test(combinedText)) {
    assunto = "PNATE";
  } else if (/caminho da escola|ônibus|veículo|pregão/i.test(combinedText)) {
    assunto = "Caminho da Escola";
  }

  // 3. UF e Município com Title Case perfeito
  let uf = "GO";
  let municipio = "Município Atendido";
  const muniMatch = combinedText.match(/(?:município|munícipio|cidade|prefeitura)?\s*(?:de\s+)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?)\s*(?:\/|-|,|\s)\s*\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i);
  
  if (muniMatch) {
    const rawMuni = muniMatch[1].trim();
    const noise = ["município", "munícipio", "cidade", "prefeitura", "do", "da", "de"];
    if (!noise.includes(rawMuni.toLowerCase())) {
      municipio = toTitleCase(rawMuni);
      uf = muniMatch[2].toUpperCase();
    }
  }

  // 4. Extração de Nome do Atendido e Telefone Real
  const atendidoNome = extractPersonName(combinedText, tecnicoName);
  const telefone = extractPhone(combinedText);
  const names = extractAllPersonNames(combinedText, tecnicoName);
  const dates = extractAllDatesFromChat(combinedText);

  // 5. Consulta ao banco de capacitação oficial online
  const trainingInfo = await lookupTrainingInfo(municipio, uf, atendidoNome);

  // 6. Filtragem de linhas inúteis do WhatsApp (criptografia, etc.)
  const ignorePhrases = ["criptografia", "mensagens e as chamadas", "código de segurança", "mudou", "entrou usando o link", "saiba mais"];
  const lines = combinedText.split('\n').map(l => l.trim()).filter(Boolean);
  const meaningfulLines = lines.filter(l => !ignorePhrases.some(ign => l.toLowerCase().includes(ign)));

  // 7. Resumo da Demanda
  let resumoDemanda = "";
  if (meaningfulLines.length > 0) {
    const topicLine = meaningfulLines.find(l => /dúvida|duvida|prestação|prestacao|adesão|adesao|cadastro|rota|ônibus|sistema|acesso|regularização/i.test(l));
    if (topicLine) {
      resumoDemanda = topicLine.replace(/^\[.*?\]\s*/, '').replace(/^.*?:/, '').trim().slice(0, 90);
    } else {
      const cleanFirst = meaningfulLines[0].replace(/^\[.*?\]\s*/, '').replace(/^.*?:/, '').trim();
      resumoDemanda = cleanFirst.slice(0, 90);
    }
  }
  if (!resumoDemanda) {
    resumoDemanda = `Atendimento e suporte sobre ${assunto} do município de ${municipio}`;
  }

  // 8. Observações
  const obsLines = meaningfulLines.map(l => l.replace(/^\[.*?\]\s*/, ''));
  let observacoes = obsLines.slice(0, 6).join('\n');
  if (!observacoes) observacoes = combinedText.slice(0, 300);

  if (trainingInfo.capacitacao_participou === "Sim") {
    const pNome = trainingInfo.nome_participante || "";
    const pCpf = trainingInfo.cpf || "";
    const cpfInfo = pCpf ? ` (CPF: ${pCpf})` : "";
    observacoes += `\n\n[Formação Confirmada]: Participante ${pNome}${cpfInfo} presente na capacitação de ${trainingInfo.capacitacao_local}.`;
  }

  // 9. Consulta da próxima linha livre na planilha oficial
  const nextRow = await fetchLiveNextRow();

  return {
    success: true,
    record: {
      cecate_responsavel: "CECATE CO",
      iniciativa: "Município",
      tecnico: tecnicoName || "Matheus Morato",
      meio_contato: "Whats App",
      data_atendimento: dataAtendimento,
      assunto: assunto,
      resumo_demanda: resumoDemanda,
      uf: uf,
      municipio: municipio,
      capacitacao_participou: trainingInfo.capacitacao_participou,
      capacitacao_local: trainingInfo.capacitacao_local,
      capacitacao_data: trainingInfo.capacitacao_data,
      atendido_nome: atendidoNome,
      atendido_telefone: telefone,
      atendido_cargo: "Gestor",
      municipio_respondeu: "Sim",
      situacao: "Resolvida",
      observacoes: observacoes
    },
    extracted_names: names.length > 0 ? names : [atendidoNome],
    extracted_dates: dates,
    raw_chat_text: combinedText,
    next_row: nextRow
  };
}
