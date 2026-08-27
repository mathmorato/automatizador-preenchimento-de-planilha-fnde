import csv
import io
import urllib.request
import re
from typing import Dict, Optional, List, Any

TRAINING_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1CAZBdzN_Wz_z-XM1vrhKTtCcE3PNuTSd8QW9b5cC3Pk/export?format=csv&gid=943666845"

_cached_training_data = []

def normalize_text(text: str) -> str:
    """Normaliza o texto removendo acentos, caracteres especiais e espaços extras."""
    if not text:
        return ""
    text = text.upper()
    replacements = {
        'Á': 'A', 'À': 'A', 'Â': 'A', 'Ã': 'A',
        'É': 'E', 'Ê': 'E',
        'Í': 'I',
        'Ó': 'O', 'Ô': 'O', 'Õ': 'O',
        'Ú': 'U', 'Ü': 'U',
        'Ç': 'C'
    }
    for orig, rep in replacements.items():
        text = text.replace(orig, rep)
    text = re.sub(r'[^A-Z0-9\s]', '', text)
    return " ".join(text.split())

def fetch_training_database():
    """Baixa e processa os dados de participantes da formação 2024-2025."""
    global _cached_training_data
    if _cached_training_data:
        return _cached_training_data

    try:
        req = urllib.request.Request(
            TRAINING_SHEET_CSV_URL,
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read().decode('utf-8', errors='ignore')

        records = []
        reader = csv.reader(io.StringIO(content))
        
        header_found = False
        for row in reader:
            if not row or len(row) < 8:
                continue
                
            if "MUNICÍPIO CONVIDADO" in row[6].upper() or "ESTADO" in row[1].upper():
                header_found = True
                continue

            if not header_found:
                continue

            # Colunas da planilha de formações:
            # 0: CECATE, 1: Estado (UF), 2: Local da Formação, 3: Ano, 4: Data da Formação,
            # 5: IBGE, 6: Município Convidado, 7: Participou (Sim/Não), 8: Nome do participante, 9: CPF
            uf = row[1].strip().upper() if len(row) > 1 else ""
            local = row[2].strip() if len(row) > 2 else ""
            ano = row[3].strip() if len(row) > 3 else ""
            data_formacao = row[4].strip() if len(row) > 4 else ""
            muni_convidado = row[6].strip() if len(row) > 6 else ""
            participou = row[7].strip().upper() if len(row) > 7 else ""
            nome_participant = row[8].strip() if len(row) > 8 else ""
            cpf_participant = row[9].strip() if len(row) > 9 else ""

            records.append({
                "uf": uf,
                "local": local,
                "ano": ano,
                "data_formacao": data_formacao,
                "municipio": muni_convidado,
                "municipio_norm": normalize_text(muni_convidado),
                "participou": "SIM" in participou,
                "nome": nome_participant,
                "nome_norm": normalize_text(nome_participant),
                "cpf": cpf_participant
            })

        _cached_training_data = records
        return _cached_training_data
    except Exception as e:
        print(f"[Aviso] Não foi possível baixar a planilha de formações online: {e}")
        return []

def lookup_training_info(municipio: str, uf: str = "", person_name: str = "") -> Dict[str, str]:
    """
    Consulta o banco de dados oficial de formações 2024-2025 pelo município e nome da pessoa.
    Retorna o dicionário contendo capacitacao_participou ('Sim'/'Não'), capacitacao_local, capacitacao_data, nome do participante e CPF.
    """
    muni_norm = normalize_text(municipio)
    uf_norm = uf.strip().upper()
    person_norm = normalize_text(person_name)

    if not muni_norm or muni_norm in ["MUNICIPIO ATENDIDO", "MUNICIPIO"]:
        return {
            "capacitacao_participou": "Não",
            "capacitacao_local": "",
            "capacitacao_data": "",
            "nome_participante": "",
            "cpf": ""
        }

    records = fetch_training_database()
    if not records:
        return {
            "capacitacao_participou": "Não",
            "capacitacao_local": "",
            "capacitacao_data": "",
            "nome_participante": "",
            "cpf": ""
        }

    # 1. Busca por Município + UF + Participou == True
    matches = []
    for r in records:
        if r["participou"] and r["municipio_norm"] == muni_norm:
            if not uf_norm or r["uf"] == uf_norm:
                matches.append(r)

    # 2. Busca parcial por município
    if not matches:
        for r in records:
            if r["participou"] and (muni_norm in r["municipio_norm"] or r["municipio_norm"] in muni_norm):
                if not uf_norm or r["uf"] == uf_norm:
                    matches.append(r)

    if matches:
        # Se houver match de nome de participante, prioriza ele
        best_match = matches[0]
        if person_norm:
            for m in matches:
                if person_norm in m["nome_norm"] or m["nome_norm"] in person_norm:
                    best_match = m
                    break

        local_formatted = best_match["local"].title()
        if best_match["uf"] and best_match["uf"] not in local_formatted.upper():
            local_formatted += f" - {best_match['uf']}"

        data_formatted = best_match["data_formacao"]
        if best_match["ano"] and best_match["ano"] not in data_formatted:
            data_formatted += f" de {best_match['ano']}"

        return {
            "capacitacao_participou": "Sim",
            "capacitacao_local": local_formatted,
            "capacitacao_data": data_formatted,
            "nome_participante": best_match["nome"].title(),
            "cpf": best_match["cpf"]
        }

    return {
        "capacitacao_participou": "Não",
        "capacitacao_local": "",
        "capacitacao_data": "",
        "nome_participante": "",
        "cpf": ""
    }

def get_all_training_participants_for_municipio(municipio: str, uf: str = "") -> List[Dict[str, str]]:
    """
    Retorna TODAS as pessoas daquele município que participaram da capacitação/formação.
    """
    muni_norm = normalize_text(municipio)
    uf_norm = uf.strip().upper() if uf else ""

    if not muni_norm or muni_norm in ["MUNICIPIO ATENDIDO", "MUNICIPIO"]:
        return []

    records = fetch_training_database()
    if not records:
        return []

    matches = []
    seen_names = set()

    for r in records:
        if r["participou"] and r["nome"]:
            row_muni = r["municipio_norm"]
            # Verifica correspondência de município
            if row_muni == muni_norm or (len(muni_norm) >= 4 and muni_norm in row_muni) or (len(row_muni) >= 4 and row_muni in muni_norm):
                nome_clean = r["nome"].title()
                if nome_clean not in seen_names:
                    seen_names.add(nome_clean)

                    local_formatted = r["local"].title()
                    if r["uf"] and r["uf"] not in local_formatted.upper():
                        local_formatted += f" - {r['uf']}"

                    data_formatted = r["data_formacao"]
                    if r["ano"] and r["ano"] not in data_formatted:
                        data_formatted += f" de {r['ano']}"

                    matches.append({
                        "nome": nome_clean,
                        "cpf": r["cpf"],
                        "municipio": r["municipio"].title(),
                        "uf": r["uf"],
                        "local": local_formatted,
                        "data": data_formatted
                    })

    return matches
