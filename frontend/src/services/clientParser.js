import JSZip from 'jszip';

const ESTADOS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

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
      return name.replace(/\b\w/g, l => l.toUpperCase());
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
      return clean.replace(/\b\w/g, l => l.toUpperCase());
    }
  }

  return "Gestor Municipal";
}

export function extractAllPersonNames(text, tecnicoName = "") {
  if (!text) return [];
  const names = [];
  const senders = text.match(/\]\s*([^:\n]+):/g) || [];
  const techKeywords = ["cecate", "suporte", "matheus", "willer", "marcos", "lara", "kariny", "dheovanna", "técnico", "tecnico"];
  if (tecnicoName) techKeywords.push(tecnicoName.toLowerCase());

  for (const s of senders) {
    const clean = s.replace(/\]\s*/, '').replace(':', '').trim();
    const isPhone = /^\+?\d+|\d{4,}/.test(clean);
    const isTech = techKeywords.some(tk => clean.toLowerCase().includes(tk));
    if (!isPhone && !isTech && clean.length > 2 && clean.length < 40) {
      names.push(clean.replace(/\b\w/g, l => l.toUpperCase()));
    }
  }

  const introMatch = text.match(/(?:meu\s+nome\s+[ée]|me\s+chamo|sou\s+a|sou\s+o)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?)/gi) || [];
  for (const im of introMatch) {
    const n = im.split(/\s+/).slice(-2).join(' ').trim();
    if (n.length > 2) names.push(n.replace(/\b\w/g, l => l.toUpperCase()));
  }

  return Array.from(new Set(names));
}

export function extractAllDatesFromChat(text) {
  if (!text) return [new Date().toLocaleDateString('pt-BR')];
  const matches = text.match(/\b\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}\b/g) || [];
  const unique = Array.from(new Set(matches));
  return unique.length > 0 ? unique : [new Date().toLocaleDateString('pt-BR')];
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

  const todayStr = new Date().toLocaleDateString('pt-BR');
  let dataAtendimento = todayStr;
  const dateMatch = combinedText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  if (dateMatch) {
    dataAtendimento = dateMatch[1];
  }

  let assunto = "SETE";
  if (/pnate/i.test(combinedText)) {
    assunto = "PNATE";
  } else if (/caminho da escola|ônibus|veículo|pregão/i.test(combinedText)) {
    assunto = "Caminho da Escola";
  }

  let uf = "GO";
  let municipio = "Município Atendido";
  const muniMatch = combinedText.match(/(?:município|cidade|prefeitura)?\s*(?:de\s+)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?)\s*(?:\/|-|,|\s)\s*\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i);
  if (muniMatch) {
    municipio = muniMatch[1].trim().replace(/\b\w/g, l => l.toUpperCase());
    uf = muniMatch[2].toUpperCase();
  }

  const atendidoNome = extractPersonName(combinedText, tecnicoName);
  const names = extractAllPersonNames(combinedText, tecnicoName);
  const dates = extractAllDatesFromChat(combinedText);

  let resumoDemanda = `Atendimento e suporte sobre ${assunto} do município de ${municipio}`;
  const lines = combinedText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    const topicLine = lines.find(l => /dúvida|duvida|prestação|prestacao|adesão|adesao|cadastro|rota|ônibus|sistema|acesso/i.test(l));
    if (topicLine) {
      resumoDemanda = topicLine.slice(0, 90).replace(/^\[.*?\]\s*/, '').replace(/^.*?:/, '').trim();
    } else {
      const cleanFirst = lines[0].replace(/^\[.*?\]\s*/, '').replace(/^.*?:/, '').trim();
      if (cleanFirst.length > 10) resumoDemanda = cleanFirst.slice(0, 90);
    }
  }

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
      capacitacao_participou: "Não",
      capacitacao_local: "",
      capacitacao_data: "",
      atendido_nome: atendidoNome,
      atendido_telefone: "",
      atendido_cargo: "Gestor",
      municipio_respondeu: "Sim",
      situacao: "Resolvida",
      observacoes: combinedText.slice(0, 500) || "Atendimento realizado com sucesso."
    },
    extracted_names: names.length > 0 ? names : [atendidoNome],
    extracted_dates: dates,
    raw_chat_text: combinedText
  };
}
