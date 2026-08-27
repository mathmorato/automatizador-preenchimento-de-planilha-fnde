from typing import List, Dict, Any
from ..sheets_service.google_sheets_client import fetch_live_csv_data

def find_similar_sheet_examples(assunto: str = "SETE", query_text: str = "", limit: int = 5) -> List[Dict[str, str]]:
    """
    Busca na planilha do Google Sheets (aba 'Atendimento aos entes') os registros reais anteriores
    mais semelhantes ao assunto e texto da conversa atual.
    Retorna uma lista de exemplos com 'resumo_demanda' e 'observacoes'.
    """
    try:
        rows = fetch_live_csv_data()
        if not rows or len(rows) <= 1:
            return []

        assunto_clean = (assunto or "SETE").strip().upper()
        query_words = set(w.lower() for w in query_text.split() if len(w) > 3)

        matching_rows = []
        for r in rows[1:]:  # Pula o cabeçalho
            if len(r) > 17:
                row_assunto = str(r[5]).strip().upper()
                resumo = str(r[6]).strip()
                obs = str(r[17]).strip()

                if not resumo and not obs:
                    continue

                # Filtra por assunto se aplicável
                if assunto_clean in row_assunto or row_assunto in assunto_clean or not row_assunto:
                    combined_text = (resumo + " " + obs).lower()
                    score = sum(1 for w in query_words if w in combined_text)

                    matching_rows.append({
                        "resumo": resumo,
                        "observacoes": obs,
                        "assunto": row_assunto,
                        "municipio": r[8] if len(r) > 8 else "",
                        "score": score
                    })

        # Ordena por relevância e pega os top 'limit'
        matching_rows.sort(key=lambda x: x["score"], reverse=True)
        
        # Garante diversidade eliminando duplicatas exatas
        unique_examples = []
        seen = set()
        for item in matching_rows:
            key = (item["resumo"], item["observacoes"])
            if key not in seen:
                seen.add(key)
                unique_examples.append(item)
                if len(unique_examples) >= limit:
                    break

        return unique_examples
    except Exception as e:
        print(f"[Aviso Busca Planilha]: {e}")
        return []
