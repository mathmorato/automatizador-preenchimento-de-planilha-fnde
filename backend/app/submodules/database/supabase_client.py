import os
from typing import Optional, List, Dict, Any
from supabase import create_client, Client
from ...config import settings
from ..schemas.attendance_schema import AttendanceRecord

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://bldooffwqjsjoxqkuivr.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_6JqdakJGKDHB6MaGjuV-3g_BNv7BT0S")

def get_supabase_client() -> Optional[Client]:
    """Retorna o cliente autenticado do Supabase."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[Aviso Supabase Client]: {e}")
        return None

def save_attendance_to_supabase(record: AttendanceRecord, target_row: int, user_email: str) -> bool:
    """Insere o atendimento na tabela 'attendance_records' do Supabase na nuvem."""
    client = get_supabase_client()
    if not client:
        return False

    payload = {
        "target_row": target_row,
        "cecate_responsavel": record.cecate_responsavel,
        "iniciativa": record.iniciativa,
        "tecnico": record.tecnico,
        "meio_contato": record.meio_contato,
        "data_atendimento": record.data_atendimento,
        "assunto": record.assunto,
        "resumo_demanda": record.resumo_demanda,
        "uf": record.uf,
        "municipio": record.municipio,
        "capacitacao_participou": record.capacitacao_participou,
        "capacitacao_local": record.capacitacao_local or "",
        "capacitacao_data": record.capacitacao_data or "",
        "atendido_nome": record.atendido_nome or "",
        "atendido_telefone": record.atendido_telefone or "",
        "atendido_cargo": record.atendido_cargo or "Gestor",
        "municipio_respondeu": record.municipio_respondeu,
        "situacao": record.situacao,
        "observacoes": record.observacoes or "",
        "user_email": user_email or "usuario@cecate.ufg.br"
    }

    try:
        res = client.table("attendance_records").insert(payload).execute()
        return True
    except Exception as e:
        print(f"[Aviso Supabase Insert]: {e}")
        return False

def get_all_attendances_from_supabase() -> List[Dict[str, Any]]:
    """Consulta todos os atendimentos gravados na nuvem do Supabase."""
    client = get_supabase_client()
    if not client:
        return []
    try:
        res = client.table("attendance_records").select("*").order("id", desc=True).execute()
        return res.data or []
    except Exception as e:
        print(f"[Aviso Supabase Select]: {e}")
        return []
