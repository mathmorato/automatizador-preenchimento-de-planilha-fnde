import sqlite3
import os
import hashlib
import random
import string
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from ..database.supabase_client import save_attendance_to_supabase, get_all_attendances_from_supabase

DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")

def init_db():
    """Inicializa as tabelas de usuários, recuperação, atendimentos e treinos no banco local."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Tabela de Usuários
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Tabela de Códigos de Recuperação de Senha
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            code TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used INTEGER DEFAULT 0
        )
    """)

    # Tabela de Aprendizado Contínuo da IA
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ai_training_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT,
            assunto TEXT,
            approved_resumo TEXT,
            approved_observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Tabela Principal de Atendimentos Registrados
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attendance_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_row INTEGER,
            cecate_responsavel TEXT,
            iniciativa TEXT,
            tecnico TEXT,
            meio_contato TEXT,
            data_atendimento TEXT,
            assunto TEXT,
            resumo_demanda TEXT,
            uf TEXT,
            municipio TEXT,
            capacitacao_participou TEXT,
            capacitacao_local TEXT,
            capacitacao_data TEXT,
            atendido_nome TEXT,
            atendido_telefone TEXT,
            atendido_cargo TEXT,
            municipio_respondeu TEXT,
            situacao TEXT,
            observacoes TEXT,
            user_email TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Garantir que a conta oficial matheus.morato1997@gmail.com esteja cadastrada
    pwd_h = hash_password("123456")
    cursor.execute("SELECT id FROM users WHERE email = 'matheus.morato1997@gmail.com'")
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
            ("Matheus Morato", "matheus.morato1997@gmail.com", pwd_h)
        )
    
    conn.commit()
    conn.close()

def hash_password(password: str) -> str:
    salt = b"cecate_fnde_ufg_secure_salt_2026"
    pwd_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return pwd_hash.hex()

def register_user(name: str, email: str, password: str) -> dict:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    email_clean = email.strip().lower()
    name_clean = name.strip()
    
    cursor.execute("SELECT id FROM users WHERE email = ?", (email_clean,))
    if cursor.fetchone():
        conn.close()
        raise ValueError("Este e-mail já está cadastrado no sistema. Por favor, faça login.")
        
    pwd_h = hash_password(password)
    cursor.execute(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
        (name_clean, email_clean, pwd_h)
    )
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return {
        "id": user_id,
        "name": name_clean,
        "email": email_clean
    }

def authenticate_user(email: str, password: str) -> dict:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    email_clean = email.strip().lower()
    pwd_h = hash_password(password)
    
    cursor.execute("SELECT id, name, email, password_hash FROM users WHERE email = ?", (email_clean,))
    row = cursor.fetchone()
    
    if not row:
        # Se a conta ainda não existir, cria a conta automaticamente no primeiro acesso
        name_clean = email_clean.split("@")[0].replace(".", " ").title()
        cursor.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
            (name_clean, email_clean, pwd_h)
        )
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return {
            "id": user_id,
            "name": name_clean,
            "email": email_clean
        }
        
    user_id, name, user_email, stored_hash = row
    if stored_hash != pwd_h:
        conn.close()
        raise ValueError("Senha incorreta. Verifique a senha digitada ou clique em 'Esqueceu a senha?'.")
        
    conn.close()
    return {
        "id": user_id,
        "name": name,
        "email": user_email
    }

def create_password_reset_code(email: str) -> str:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    email_clean = email.strip().lower()
    cursor.execute("SELECT id FROM users WHERE email = ?", (email_clean,))
    if not cursor.fetchone():
        conn.close()
        raise ValueError("E-mail não encontrado no sistema. Verifique o endereço digitado.")
        
    code = ''.join(random.choices(string.digits, k=6))
    expires_at = datetime.now() + timedelta(minutes=15)
    
    cursor.execute("UPDATE password_resets SET used = 1 WHERE email = ?", (email_clean,))
    cursor.execute(
        "INSERT INTO password_resets (email, code, expires_at, used) VALUES (?, ?, ?, 0)",
        (email_clean, code, expires_at.strftime("%Y-%m-%d %H:%M:%S"))
    )
    conn.commit()
    conn.close()
    
    return code

def reset_password_with_code(email: str, code: str, new_password: str) -> bool:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    email_clean = email.strip().lower()
    code_clean = code.strip()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    cursor.execute(
        "SELECT id FROM password_resets WHERE email = ? AND code = ? AND used = 0 AND expires_at >= ?",
        (email_clean, code_clean, now_str)
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise ValueError("Código de verificação inválido ou expirado. Solicite um novo código.")
        
    cursor.execute("UPDATE password_resets SET used = 1 WHERE id = ?", (row[0],))
    new_pwd_h = hash_password(new_password)
    cursor.execute("UPDATE users SET password_hash = ? WHERE email = ?", (new_pwd_h, email_clean))
    
    conn.commit()
    conn.close()
    return True

def save_ai_training_example(user_email: str, assunto: str, approved_resumo: str, approved_observacoes: str):
    if not approved_resumo and not approved_observacoes:
        return
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO ai_training_feedback (user_email, assunto, approved_resumo, approved_observacoes) VALUES (?, ?, ?, ?)",
        (user_email or "usuario@cecate.ufg.br", assunto or "SETE", approved_resumo or "", approved_observacoes or "")
    )
    conn.commit()
    conn.close()

def get_recent_training_examples(assunto: Optional[str] = None, limit: int = 5) -> List[Dict[str, str]]:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    if assunto:
        cursor.execute(
            "SELECT approved_resumo, approved_observacoes FROM ai_training_feedback WHERE assunto = ? ORDER BY id DESC LIMIT ?",
            (assunto, limit)
        )
    else:
        cursor.execute(
            "SELECT approved_resumo, approved_observacoes FROM ai_training_feedback ORDER BY id DESC LIMIT ?",
            (limit,)
        )
    rows = cursor.fetchall()
    conn.close()
    return [{"resumo": r[0], "observacoes": r[1]} for r in rows if r[0] or r[1]]

def save_attendance_to_db(record, target_row: int, user_email: str) -> int:
    """Salva o atendimento tanto no banco local quanto na nuvem Supabase."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO attendance_records (
            target_row, cecate_responsavel, iniciativa, tecnico, meio_contato,
            data_atendimento, assunto, resumo_demanda, uf, municipio,
            capacitacao_participou, capacitacao_local, capacitacao_data,
            atendido_nome, atendido_telefone, atendido_cargo, municipio_respondeu,
            situacao, observacoes, user_email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        target_row, record.cecate_responsavel, record.iniciativa, record.tecnico, record.meio_contato,
        record.data_atendimento, record.assunto, record.resumo_demanda, record.uf, record.municipio,
        record.capacitacao_participou, record.capacitacao_local or "", record.capacitacao_data or "",
        record.atendido_nome or "", record.atendido_telefone or "", record.atendido_cargo or "Gestor",
        record.municipio_respondeu, record.situacao, record.observacoes or "", user_email or "usuario@cecate.ufg.br"
    ))
    record_id = cursor.lastrowid
    conn.commit()
    conn.close()

    # Sincronizar simultaneamente com a Nuvem Supabase
    try:
        save_attendance_to_supabase(record, target_row, user_email)
    except Exception as e:
        print(f"[Aviso Supabase Sync]: {e}")

    return record_id

def get_all_attendances() -> List[Dict]:
    """Retorna todos os atendimentos salvos."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM attendance_records ORDER BY id DESC")
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return get_all_attendances_from_supabase()

    return [dict(zip(columns, row)) for row in rows]

# Inicializar banco de dados
init_db()
