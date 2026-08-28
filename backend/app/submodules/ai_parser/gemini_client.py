import json
import re
from datetime import datetime
from typing import List, Optional
from PIL import Image
from ...config import settings
from .prompt_templates import SYSTEM_PROMPT_PARSER
from ..schemas.attendance_schema import AttendanceRecord
from .training_lookup import lookup_training_info
from ..auth.db import get_recent_training_examples
from .sheet_context_lookup import find_similar_sheet_examples

ESTADOS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"]

def extract_person_name(text: str, tecnico_name: str = "") -> str:
    """
    Extrai o nome do atendido/gestor a partir de apresentações na conversa,
    saudações ("Bom dia Neide", "Olá Dra. Maria"), assinaturas ou remetentes do WhatsApp.
    """
    if not text:
        return "Gestor Municipal"

    tech_keywords = ["cecate", "suporte", "matheus", "willer", "marcos", "lara", "kariny", "dheovanna", "técnico", "tecnico", "fnde", "admin"]
    if tecnico_name:
        tech_keywords.append(tecnico_name.lower())

    # 1. Apresentações explícitas ("Meu nome é X", "Me chamo X", "Sou a X", "Aqui é o X")
    pattern_intro = r'(?:meu\s+nome\s+[ée]|me\s+chamo|sou\s+a|sou\s+o|aqui\s+[ée]\s+a|aqui\s+[ée]\s+o)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+(?:de|da|do|dos|das|e)\s+)?(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+){0,2})'
    intro_match = re.search(pattern_intro, text, re.IGNORECASE)
    if intro_match:
        name = intro_match.group(1).strip().title()
        noise = ["gestor", "secretário", "secretaria", "diretor", "técnico", "tecnico", "professor", "professora", "município", "prefeitura"]
        if name.lower() not in noise and len(name) > 2 and not any(tk in name.lower() for tk in tech_keywords):
            return name

    # 2. Saudações e referências diretas ("Boa tarde Neide", "Olá Dra. Maria", "Falo com Carlos")
    pattern_greetings = r'(?:boa\s+tarde|bom\s+dia|boa\s+noite|olá|ola|prezado[a]?|senhor[a]?|doutor[a]?|falar\s+com|falo\s+com)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+){0,2})'
    for match in re.finditer(pattern_greetings, text, re.IGNORECASE):
        candidate = match.group(1).strip().title()
        noise = ["gestor", "secretário", "secretaria", "diretor", "técnico", "tecnico", "professor", "professora", "prefeitura", "município", "tudo", "como", "esta", "está", "tudo bem"]
        if candidate.lower() not in noise and len(candidate) > 2 and not any(tk in candidate.lower() for tk in tech_keywords):
            return candidate

    # 3. Remetente das mensagens do WhatsApp
    senders = re.findall(r'\]\s*([^:\n]+):', text)
    for sender in senders:
        s_clean = sender.strip()
        is_phone = bool(re.search(r'^\+?\d+|\d{4,}', s_clean))
        is_tech = any(tk in s_clean.lower() for tk in tech_keywords)
        if not is_phone and not is_tech and 2 < len(s_clean) < 40:
            return s_clean.title()

    # 4. Busca entre todos os nomes identificados
    all_names = extract_all_person_names(text, tecnico_name)
    if all_names:
        return all_names[0]

    return "Gestor Municipal"


def extract_all_person_names(text: str, tecnico_name: str = "") -> List[str]:
    """
    Extrai TODOS os possíveis nomes de pessoas mencionados na conversa do atendimento.
    """
    if not text:
        return []

    names = []
    
    # 1. Apresentações explícitas
    pattern_intro = r'(?:meu\s+nome\s+[ée]|me\s+chamo|sou\s+a|sou\s+o|aqui\s+[ée]\s+a|aqui\s+[ée]\s+o)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+(?:de|da|do|dos|das|e)\s+)?(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+){1,3})'
    for m in re.finditer(pattern_intro, text, re.IGNORECASE):
        names.append(m.group(1).strip().title())

    # 2. Títulos e referências
    pattern_titles = r'(?:professora?|secretári[ao]|senho[ra]|douto[ra]|gesto[ra]|direto[ra])\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+){0,2})'
    for m in re.finditer(pattern_titles, text, re.IGNORECASE):
        names.append(m.group(1).strip().title())

    # 3. Remetentes das mensagens do WhatsApp
    senders = re.findall(r'\]\s*([^:\n]+):', text)
    tech_keywords = ["cecate", "suporte", "matheus", "willer", "marcos", "lara", "kariny", "dheovanna", "técnico", "tecnico", "fnde", "admin"]
    if tecnico_name:
        tech_keywords.append(tecnico_name.lower())

    for sender in senders:
        s_clean = sender.strip()
        is_phone = bool(re.search(r'^\+?\d+|\d{4,}', s_clean))
        is_tech = any(tk in s_clean.lower() for tk in tech_keywords)
        if not is_phone and not is_tech and 2 < len(s_clean) < 40:
            names.append(s_clean.title())

    # 4. Nomes próprios maiúsculos soltos
    pattern_capitalized = r'\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}\s+(?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}|\b(?:de|da|do|dos|das)\b\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}))\b'
    for m in re.finditer(pattern_capitalized, text):
        candidate = m.group(1).strip()
        noise = ["cecate co", "fnde gov", "transporte escolar", "prefeitura municipal", "educacao go", "caminho da", "caminho de", "dia de", "boa tarde", "bom dia", "boa noite", "whats app"]
        if not any(n in candidate.lower() for n in noise):
            names.append(candidate.title())

    stopwords = {"de", "da", "do", "dos", "das", "e", "gestor", "secretario", "secretaria", "diretor", "tecnico", "tecnica", "professor", "professora", "atendimento", "solicitacao", "prefeitura", "municipio", "para", "sobre", "educacao", "duvidas"}
    unique = []
    for n in names:
        words = [w for w in n.split() if w.lower() not in stopwords]
        if words:
            clean_name = " ".join(words)
            if clean_name not in unique and len(clean_name) >= 3 and not any(clean_name in u for u in unique):
                unique.append(clean_name)

    return unique

def extract_all_dates_from_chat(text: str) -> List[str]:
    """
    Extrai TODAS as datas mencionadas no texto do atendimento/chat do WhatsApp.
    """
    if not text:
        return [datetime.now().strftime("%d/%m/%Y")]

    matches = re.findall(r'\b(\d{1,2})[/\.-](\d{1,2})[/\.-](\d{2,4})\b', text)
    
    dates = []
    for day_s, month_s, year_s in matches:
        try:
            day = int(day_s)
            month = int(month_s)
            year = int(year_s)
            if len(year_s) == 2:
                year += 2000
            
            if 1 <= day <= 31 and 1 <= month <= 12 and 2020 <= year <= 2035:
                formatted_date = f"{day:02d}/{month:02d}/{year}"
                if formatted_date not in dates:
                    dates.append(formatted_date)
        except ValueError:
            continue

    if not dates:
        dates.append(datetime.now().strftime("%d/%m/%Y"))

    return dates

def regenerate_field_content(
    field_name: str,
    current_value: str,
    raw_chat_text: str = "",
    user_instruction: str = "",
    assunto: str = "SETE"
) -> str:
    """
    Releia a conversa completa do atendimento e utiliza a IA treinada (Gemini 2.5/1.5)
    para reinterpretar e aprimorar o campo solicitado (resumo_demanda, observacoes ou atendido_nome).
    """
    # 1. Exemplos da Tabela de Treinamento
    training_examples = get_recent_training_examples(assunto, limit=3)
    
    # 2. Exemplos Reais Diretos da Planilha do Google Sheets (Aprendizado da Planilha ao Vivo)
    sheet_examples = find_similar_sheet_examples(assunto, raw_chat_text or current_value, limit=4)
    
    examples_prompt = ""
    if field_name in ["resumo_demanda", "observacoes"]:
        examples_prompt = "\n[EXEMPLOS REAIS RETIRADOS DA PLANILHA OFICIAL DO GOOGLE SHEETS PARA APRENDIZADO DA IA]:\n"
        if sheet_examples:
            for idx, ex in enumerate(sheet_examples, start=1):
                val = ex["resumo"] if field_name == "resumo_demanda" else ex["observacoes"]
                if val:
                    examples_prompt += f"Exemplo Real {idx} (Planilha - {ex['assunto']}): {val}\n"
        
        if training_examples:
            for idx, ex in enumerate(training_examples, start=len(sheet_examples)+1):
                val = ex["resumo"] if field_name == "resumo_demanda" else ex["observacoes"]
                if val:
                    examples_prompt += f"Exemplo Aprovado {idx}: {val}\n"

    instruction = user_instruction.strip() if user_instruction else "Reler a conversa, interpretar a melhor resposta e aprimorar o padrão do texto conforme os exemplos da planilha oficial do CECATE FNDE."
    
    chat_block = ""
    if raw_chat_text and len(raw_chat_text.strip()) > 10:
        chat_block = f"\n--- INÍCIO DA CONVERSA COMPLETA DO ATENDIMENTO ---\n{raw_chat_text[:8000]}\n--- FIM DA CONVERSA COMPLETA DO ATENDIMENTO ---\n"

    if field_name == "atendido_nome":
        prompt = f"""Você é uma Inteligência Artificial especialista em extração de nomes de pessoas em conversas do WhatsApp do FNDE / CECATE CO.
Sua missão é RELER A CONVERSA COMPLETA DO ATENDIMENTO abaixo e identificar O NOME REAL DA PESSOA ATENDIDA (gestor, secretário, usuário do município ou conselheiro).

{chat_block}

REGRAS OBRIGATÓRIAS:
1. Releia atentamente todas as falas, apresentações ("Meu nome é X", "Me chamo X", "Sou a X", "Aqui é o X"), saudações ("Boa tarde, Neide") e referências feitas pelo técnico ("Combinado, Lucia Duarte").
2. NUNCA retorne o nome dos técnicos do CECATE CO (ex: Matheus Morato, Willer Carvalho, Lara, Marcos, Kariny, Dheovanna).
3. Se encontrar o nome da pessoa atendida, retorne APENAS o nome limpo formatado em maiúsculas/minúsculas adequadas (ex: "Neide", "Maria José Silva", "Carlos Eduardo").
4. Se absolutamente nenhum nome próprio de pessoa atendida for mencionado na conversa, retorne "Gestor Municipal".
5. Retorne EXCLUSIVAMENTE o nome sem textos adicionais, explicações ou aspas.
"""
    else:
        prompt = f"""Você é uma Inteligência Artificial especialista em relatórios do FNDE / CECATE CO.
Sua missão é RELER A CONVERSA COMPLETA DO ATENDIMENTO e gerar a melhor interpretação para o campo '{field_name}'.
Aprenda com o estilo, vocabulário e padrão dos exemplos reais da planilha oficial abaixo.

{chat_block}
{examples_prompt}

[TEXTO ATUAL DO CAMPO]:
"{current_value}"

[INSTRUÇÃO DO USUÁRIO PARA APRIMORAR]:
"{instruction}"

REGRAS OBRIGATÓRIAS:
- Releia atentamente todo o histórico da conversa e interprete a melhor resposta para o campo '{field_name}'.
- Siga rigorosamente o padrão, concisão e estilo técnico dos exemplos reais da planilha do CECATE CO.
- Retorne EXCLUSIVAMENTE o texto final aprimorado para o campo.
- Não adicione explicações, aspas ou introduções.
"""


    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip() != "":
        models_to_try = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite']
        try:
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY.strip())
            for model_name in models_to_try:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=[prompt]
                    )
                    clean_res = response.text.strip().strip('"')
                    if clean_res:
                        return clean_res
                except Exception:
                    continue
        except Exception:
            pass

        try:
            import google.generativeai as genai_legacy
            genai_legacy.configure(api_key=settings.GEMINI_API_KEY.strip())
            for model_name in models_to_try:
                try:
                    model = genai_legacy.GenerativeModel(model_name)
                    response = model.generate_content([prompt])
                    clean_res = response.text.strip().strip('"')
                    if clean_res:
                        return clean_res
                except Exception:
                    continue
        except Exception:
            pass

    # Fallback refinador inteligente com releitura da conversa completa
    if field_name == "atendido_nome":
        return extract_person_name(raw_chat_text or user_instruction or current_value)
    elif field_name == "resumo_demanda":
        full_source = raw_chat_text or current_value
        rec_rule = rule_based_parse_attendance(full_source, "Técnico")
        if "curt" in user_instruction.lower() or "resum" in user_instruction.lower():
            words = rec_rule.resumo_demanda.split()
            return " ".join(words[:7]) + "..." if len(words) > 7 else rec_rule.resumo_demanda
        elif "formal" in user_instruction.lower():
            return f"Solicitação de orientação técnica sobre o programa {assunto}: {rec_rule.resumo_demanda}"
        else:
            return rec_rule.resumo_demanda
    else:
        full_source = raw_chat_text or current_value
        rec_rule = rule_based_parse_attendance(full_source, "Técnico")
        if "pendênc" in user_instruction.lower() or "pendenc" in user_instruction.lower():
            return f"{rec_rule.observacoes}\n\n[Pendência]: Aguarda envio de documento comprobatório pelo município."
        elif "resum" in user_instruction.lower():
            lines = rec_rule.observacoes.split('\n')
            return "\n".join(lines[:3])
        else:
            return rec_rule.observacoes

def rule_based_parse_attendance(text_content: Optional[str], tecnico_name: str) -> AttendanceRecord:
    text = text_content or ""
    lines = [line.strip() for line in text.split('\n') if line.strip()]

    # Data
    data_atendimento = datetime.now().strftime("%d/%m/%Y")
    date_match = re.search(r'\[?(\d{1,2}/\d{1,2}/\d{2,4})', text)
    if date_match:
        raw_date = date_match.group(1)
        parts = raw_date.split('/')
        if len(parts) == 3:
            day = parts[0].zfill(2)
            month = parts[1].zfill(2)
            year = parts[2]
            if len(year) == 2:
                year = "20" + year
            data_atendimento = f"{day}/{month}/{year}"

    # Assunto
    assunto = "SETE"
    if re.search(r'\bpnate\b', text, re.IGNORECASE):
        assunto = "PNATE"
    elif re.search(r'\bcaminho da escola\b|\bônibus\b|\bveículo\b|\bpregão\b', text, re.IGNORECASE):
        assunto = "Caminho da Escola"

    # UF e Município
    uf = "GO"
    municipio = ""
    pattern_muni_uf = r'(?:município|munícipio|cidade|prefeitura)?\s*(?:de\s+)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?)\s*(?:/|-|,|\s)\s*\b(' + '|'.join(ESTADOS) + r')\b'
    muni_uf_match = re.search(pattern_muni_uf, text, re.IGNORECASE)
    
    if muni_uf_match:
        raw_muni = muni_uf_match.group(1).strip()
        extracted_uf = muni_uf_match.group(2).upper()
        noise = ["município", "munícipio", "cidade", "prefeitura", "do", "da", "de", "sobre", "informe", "débitos"]
        if raw_muni.lower() not in noise:
            municipio = raw_muni.title()
            uf = extracted_uf

    if not municipio:
        uf_match = re.search(r'\b(' + '|'.join(ESTADOS) + r')\b', text)
        if uf_match:
            uf = uf_match.group(1).upper()
            m_simple = re.search(r'([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,})?)\s+(?:/|-|,|\s)*\b' + uf + r'\b', text)
            if m_simple and m_simple.group(1).lower() not in ["município", "cidade"]:
                municipio = m_simple.group(1).title()

    if not municipio:
        municipio = "Município Atendido"

    # Nome do Atendido (Extração Inteligente)
    atendido_nome = extract_person_name(text, tecnico_name)
    
    # Telefone
    telefone = ""
    phone_match = re.search(r'(\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4})', text)
    if phone_match:
        telefone = phone_match.group(0)

    # Consulta ao Banco de Treinamento/Capacitação
    training_info = lookup_training_info(municipio, uf, atendido_nome)

    # Resumo Demanda
    resumo_demanda = ""
    ignore_phrases = ["criptografia", "mensagens e as chamadas", "código de segurança", "mudou", "entrou usando o link"]
    meaningful_lines = []
    for line in lines:
        if not any(ign in line.lower() for ign in ignore_phrases):
            clean_line = re.sub(r'^\[.*?\]\s*', '', line)
            clean_line = re.sub(r'^.*?:', '', clean_line).strip()
            if len(clean_line) > 10:
                meaningful_lines.append(clean_line)

    if meaningful_lines:
        topic_line = next(
            (l for l in meaningful_lines if re.search(r'dúvida|duvida|prestação|prestacao|adesão|adesao|cadastro|rota|ônibus|atualização|atualizacao|relatório|erro|sistema|acesso|regularização', l, re.IGNORECASE)),
            meaningful_lines[0]
        )
        resumo_demanda = topic_line[:90].strip()
        if len(topic_line) > 90 and not resumo_demanda.endswith('.'):
            resumo_demanda += "..."
    else:
        resumo_demanda = f"Atendimento e suporte sobre {assunto} do município de {municipio}"

    # Observações
    obs_lines = [re.sub(r'^\[.*?\]\s*', '', l) for l in lines if not any(ign in l.lower() for ign in ignore_phrases)]
    observacoes = "\n".join(obs_lines[:6]) if obs_lines else text[:300]

    if training_info.get("capacitacao_participou") == "Sim":
        p_nome = training_info.get("nome_participante", "")
        p_cpf = training_info.get("cpf", "")
        cpf_info = f" (CPF: {p_cpf})" if p_cpf else ""
        observacoes += f"\n\n[Formação Confirmada]: Participante {p_nome}{cpf_info} presente na capacitação de {training_info.get('capacitacao_local')}."

    return AttendanceRecord(
        cecate_responsavel="CECATE CO",
        iniciativa="Município",
        tecnico=tecnico_name or "Matheus Morato",
        meio_contato="Whats App",
        data_atendimento=data_atendimento,
        assunto=assunto,
        resumo_demanda=resumo_demanda,
        uf=uf,
        municipio=municipio,
        capacitacao_participou=training_info.get("capacitacao_participou", "Não"),
        capacitacao_local=training_info.get("capacitacao_local", ""),
        capacitacao_data=training_info.get("capacitacao_data", ""),
        atendido_nome=atendido_nome,
        atendido_telefone=telefone,
        atendido_cargo="Gestor",
        municipio_respondeu="Sim",
        situacao="Resolvida",
        observacoes=observacoes
    )

def parse_attendance_from_content(
    text_content: Optional[str] = None,
    images: Optional[List[Image.Image]] = None,
    tecnico_name: str = "Matheus Morato",
    custom_instructions: str = ""
) -> AttendanceRecord:
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.strip() == "":
        return rule_based_parse_attendance(text_content, tecnico_name)

    sheet_examples = find_similar_sheet_examples("SETE", text_content or "", limit=4)
    training_examples = get_recent_training_examples(limit=3)
    examples_str = ""
    if sheet_examples or training_examples:
        examples_str = "\n[EXEMPLOS REAIS DE REGISTROS NA PLANILHA OFICIAL DO GOOGLE SHEETS DA EQUIPE CECATE CO PARA APRENDIZADO DA IA]:\n"
        if sheet_examples:
            for ex in sheet_examples:
                examples_str += f"- [Planilha Real - {ex['assunto']}] Resumo: {ex['resumo']} | Observações: {ex['observacoes']}\n"
        if training_examples:
            for ex in training_examples:
                examples_str += f"- [Aprovado Equip] Resumo: {ex['resumo']} | Observações: {ex['observacoes']}\n"

    prompt = f"{SYSTEM_PROMPT_PARSER}\n{examples_str}\n[INFORMACAO DO TECNICO LOGADO]: {tecnico_name}\n"
    if custom_instructions:
        prompt += f"[INSTRUCOES ADICIONAIS DO USUARIO]: {custom_instructions}\n"

    if text_content:
        prompt += f"\n--- INICIO DA CONVERSA DE TEXTO ---\n{text_content[:8000]}\n--- FIM DA CONVERSA DE TEXTO ---\n"

    contents = [prompt]
    if images:
        for img in images:
            contents.append(img)

    raw_text = None
    models_to_try = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite']

    try:
        from google import genai
        client = genai.Client(api_key=settings.GEMINI_API_KEY.strip())
        for model_name in models_to_try:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents
                )
                if response and response.text:
                    raw_text = response.text
                    break
            except Exception:
                continue
    except Exception:
        pass

    if not raw_text:
        try:
            import google.generativeai as genai_legacy
            genai_legacy.configure(api_key=settings.GEMINI_API_KEY.strip())
            for model_name in models_to_try:
                try:
                    model = genai_legacy.GenerativeModel(model_name)
                    response = model.generate_content(contents)
                    if response and response.text:
                        raw_text = response.text
                        break
                except Exception:
                    continue
        except Exception:
            pass

    if not raw_text:
        return rule_based_parse_attendance(text_content, tecnico_name)

    json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
    if not json_match:
        return rule_based_parse_attendance(text_content, tecnico_name)

    data_dict = json.loads(json_match.group(0))

    if tecnico_name and (not data_dict.get("tecnico") or data_dict.get("tecnico") == "Nome do Técnico"):
        data_dict["tecnico"] = tecnico_name

    if not data_dict.get("atendido_nome") or data_dict.get("atendido_nome") in ["Gestor Municipal", "Gestor", "Nome do Atendido"]:
        extracted_n = extract_person_name(text_content, tecnico_name)
        if extracted_n != "Gestor Municipal":
            data_dict["atendido_nome"] = extracted_n

    if data_dict.get("municipio"):
        t_info = lookup_training_info(data_dict.get("municipio"), data_dict.get("uf", ""), data_dict.get("atendido_nome", ""))
        if t_info.get("capacitacao_participou") == "Sim":
            data_dict["capacitacao_participou"] = "Sim"
            data_dict["capacitacao_local"] = t_info.get("capacitacao_local", data_dict.get("capacitacao_local"))
            data_dict["capacitacao_data"] = t_info.get("capacitacao_data", data_dict.get("capacitacao_data"))
            
            p_cpf = t_info.get("cpf", "")
            p_nome = t_info.get("nome_participante", "")
            cpf_str = f"\n\n[Formação Confirmada]: Participante {p_nome} (CPF: {p_cpf}) na capacitação de {data_dict['capacitacao_local']}."
            if "CPF:" not in data_dict.get("observacoes", ""):
                data_dict["observacoes"] = (data_dict.get("observacoes", "") + cpf_str).strip()

    record = AttendanceRecord(**data_dict)
    return record
