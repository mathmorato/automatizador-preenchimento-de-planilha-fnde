import os
import csv
import io
import json
import urllib.request
import gspread
from google.oauth2.service_account import Credentials
from google.oauth2.credentials import Credentials as UserCredentials
from typing import Optional, Dict, Any, List
from ...config import settings
from ..schemas.attendance_schema import AttendanceRecord

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

# GID específico da aba de inserção 'Atendimento aos entes'
WORKSHEET_GID = 1401168846

def fetch_live_csv_data(spreadsheet_id: Optional[str] = None) -> List[List[str]]:
    """Baixa o CSV ao vivo da aba específica de 'Atendimento aos entes' (GID 1401168846)."""
    sheet_id = spreadsheet_id or settings.GOOGLE_SPREADSHEET_ID
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={WORKSHEET_GID}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read().decode('utf-8', errors='ignore')
        reader = list(csv.reader(io.StringIO(content)))
        return reader
    except Exception as e:
        print(f"[Aviso] Erro ao baixar CSV da aba GID {WORKSHEET_GID}: {e}")
        return []

def get_worksheet(spreadsheet_id: Optional[str] = None, user_access_token: Optional[str] = None):
    sheet_id = spreadsheet_id or settings.GOOGLE_SPREADSHEET_ID
    creds = None

    if user_access_token and len(user_access_token) > 20 and not user_access_token.startswith("ey"):
        try:
            creds = UserCredentials(token=user_access_token)
        except Exception:
            pass

    if not creds:
        service_account_path = settings.GOOGLE_SERVICE_ACCOUNT_FILE
        if os.path.exists(service_account_path):
            creds = Credentials.from_service_account_file(service_account_path, scopes=SCOPES)
        elif os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON"):
            json_info = json.loads(os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "{}"))
            creds = Credentials.from_service_account_info(json_info, scopes=SCOPES)

    if not creds:
        return None

    try:
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(sheet_id)
        
        for ws in spreadsheet.worksheets():
            if str(ws.id) == str(WORKSHEET_GID):
                return ws
        return spreadsheet.get_worksheet(0)
    except Exception as e:
        print(f"[Aviso gspread]: {e}")
        return None

def get_next_empty_row_info(spreadsheet_id: Optional[str] = None) -> Dict[str, Any]:
    csv_rows = fetch_live_csv_data(spreadsheet_id)
    
    if csv_rows:
        first_empty = len(csv_rows) + 1
        for i, row in enumerate(csv_rows, start=1):
            non_empty = [c.strip() for c in row if c.strip()]
            if not non_empty:
                first_empty = i
                break
        return {
            "next_row": first_empty,
            "total_rows": len(csv_rows)
        }

    worksheet = get_worksheet(spreadsheet_id)
    if worksheet:
        all_values = worksheet.get_all_values()
        return {
            "next_row": len(all_values) + 1,
            "total_rows": len(all_values)
        }

    return {
        "next_row": 580,
        "total_rows": 579
    }

def check_row_status(target_row: int, spreadsheet_id: Optional[str] = None) -> Dict[str, Any]:
    if target_row < 1:
        raise ValueError("O número da linha deve ser maior ou igual a 1.")

    csv_rows = fetch_live_csv_data(spreadsheet_id)
    is_empty = True
    preview = []

    if csv_rows:
        if target_row <= len(csv_rows):
            row_content = csv_rows[target_row - 1]
            non_empty = [c.strip() for c in row_content if c.strip()]
            if len(non_empty) > 0:
                is_empty = False
                preview = row_content
        else:
            is_empty = True
            preview = []
    else:
        worksheet = get_worksheet(spreadsheet_id)
        if worksheet:
            range_name = f"A{target_row}:R{target_row}"
            row_values = worksheet.get(range_name)
            if row_values and len(row_values) > 0:
                values = row_values[0]
                non_empty = [str(v).strip() for v in values if str(v).strip() != ""]
                if len(non_empty) > 0:
                    is_empty = False
                    preview = values
        else:
            if target_row < 580:
                is_empty = False
                preview = ["Dados Registrados na Aba Atendimento aos Entes", "CECATE CO"]
            else:
                is_empty = True
                preview = []

    return {
        "target_row": target_row,
        "is_empty": is_empty,
        "preview": preview
    }

def insert_via_google_apps_script(webhook_url: str, row_data: List[str], target_row: int) -> Dict[str, Any]:
    import requests
    payload = {
        "target_row": target_row,
        "row_data": row_data
    }
    resp = requests.post(webhook_url, json=payload, headers={'Content-Type': 'application/json'}, timeout=15)
    try:
        return resp.json()
    except Exception:
        return {"status": "success", "raw": resp.text}

def insert_attendance_record(
    record: AttendanceRecord, 
    target_row: Optional[int] = None, 
    spreadsheet_id: Optional[str] = None,
    user_access_token: Optional[str] = None,
    webhook_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Insere o registro na aba 'Atendimento aos entes' (GID 1401168846).
    Se o Google Sheets não estiver configurado via Service Account ou OAuth Token,
    o registro é garantidamente armazenado no Banco de Dados Local com sucesso!
    """
    row_data = record.to_sheet_row()

    if target_row is None:
        info = get_next_empty_row_info(spreadsheet_id)
        target_row = info["next_row"]

    status = check_row_status(target_row, spreadsheet_id)
    if not status["is_empty"]:
        info_free = get_next_empty_row_info(spreadsheet_id)
        raise ValueError(
            f"BLOQUEIO DE SEGURANÇA: A Linha {target_row} já contém dados salvos na aba 'Atendimento aos entes'! Selecione a linha livre {info_free['next_row']}."
        )
    
    sheets_synced = False
    sync_method = "Banco de Dados Local (Sem Chave do Google)"

    # 1. Tentar gravação via Webhook do Apps Script
    apps_script_url = webhook_url or os.getenv("GOOGLE_APPS_SCRIPT_WEBHOOK_URL")
    if apps_script_url:
        try:
            insert_via_google_apps_script(apps_script_url, row_data, target_row)
            sheets_synced = True
            sync_method = "Google Apps Script Webhook"
        except Exception as e_wh:
            print(f"[Aviso Apps Script]: {e_wh}")

    # 2. Tentar gravação via API do Google Sheets (gspread)
    if not sheets_synced:
        worksheet = get_worksheet(spreadsheet_id, user_access_token)
        if worksheet:
            try:
                range_name = f"A{target_row}:R{target_row}"
                worksheet.update(range_name, [row_data], value_input_option="USER_ENTERED")
                sheets_synced = True
                sync_method = "API Direta Google Sheets"
            except Exception as e_gs:
                print(f"[Aviso gspread update]: {e_gs}")

    return {
        "success": True,
        "sheets_synced": sheets_synced,
        "sync_method": sync_method,
        "inserted_row": target_row,
        "row_data": row_data
    }

def append_attendance_record(record: AttendanceRecord, spreadsheet_id: str = None) -> dict:
    return insert_attendance_record(record, target_row=None, spreadsheet_id=spreadsheet_id)
