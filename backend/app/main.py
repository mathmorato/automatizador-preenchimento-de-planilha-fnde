import io
import csv
from typing import List, Optional
from PIL import Image
from pydantic import BaseModel, Field
from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException, status, Header
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .submodules.auth.db import (
    register_user, 
    authenticate_user, 
    create_password_reset_code, 
    reset_password_with_code,
    save_ai_training_example,
    save_attendance_to_db,
    get_all_attendances
)
from .submodules.auth.email_service import send_password_reset_email
from .submodules.auth.google_auth import verify_google_token, create_user_token
from .submodules.schemas.attendance_schema import AttendanceRecord, ParseResponse
from .submodules.ai_parser.gemini_client import (
    parse_attendance_from_content,
    regenerate_field_content,
    extract_all_person_names,
    extract_all_person_names_with_gemini,
    generate_resumo_options_with_gemini,
    extract_all_dates_from_chat
)


from .submodules.ai_parser.zip_extractor import process_whatsapp_zip
from .submodules.ai_parser.training_lookup import get_all_training_participants_for_municipio
from .submodules.sheets_service.google_sheets_client import (
    insert_attendance_record,
    get_next_empty_row_info,
    check_row_status
)

app = FastAPI(
    title="Automador de Planilha FNDE - CECATE CO",
    description="API Modular para Leitura de Chats/Prints com IA Treinada e Sincronização no Google Sheets",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RegisterRequest(BaseModel):
    name: str = Field(..., description="Nome completo do usuário")
    email: str = Field(..., description="E-mail do usuário")
    password: str = Field(..., description="Senha do usuário")

class LoginRequest(BaseModel):
    email: str = Field(..., description="E-mail do usuário")
    password: str = Field(..., description="Senha do usuário")

class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., description="E-mail cadastrado do usuário")

class ResetPasswordRequest(BaseModel):
    email: str = Field(..., description="E-mail cadastrado do usuário")
    code: str = Field(..., description="Código de 6 dígitos recebido por e-mail")
    new_password: str = Field(..., description="Nova senha do usuário")

class SheetAppendRequest(BaseModel):
    record: AttendanceRecord
    target_row: Optional[int] = Field(default=None, description="Número da linha específica desejada (opcional)")
    webhook_url: Optional[str] = Field(default=None, description="URL do Google Apps Script (opcional)")

class RegenerateFieldRequest(BaseModel):
    field_name: str = Field(..., description="'resumo_demanda', 'observacoes' ou 'atendido_nome'")
    current_value: str = Field(..., description="Texto atual do campo")
    raw_chat_text: Optional[str] = Field(default="", description="Texto completo original do chat/atendimento para releitura pela IA")
    user_instruction: Optional[str] = Field(default="", description="Comando opcional do usuário para melhorar a resposta")
    assunto: Optional[str] = Field(default="SETE", description="Programa FNDE")

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "service": "FNDE Spreadsheet Automator API",
        "database": "SQLite Local (Gratuito e Privado)",
        "spreadsheet_id": settings.GOOGLE_SPREADSHEET_ID
    }

@app.post("/api/auth/register")
def register_account(req: RegisterRequest):
    try:
        user = register_user(req.name, req.email, req.password)
        token = create_user_token(user)
        return {
            "success": True,
            "user": user,
            "token": token,
            "message": "Conta criada com sucesso!"
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Erro ao criar conta: {str(e)}")

@app.post("/api/auth/login")
def login_account(req: LoginRequest):
    try:
        user = authenticate_user(req.email, req.password)
        token = create_user_token(user)
        return {
            "success": True,
            "user": user,
            "token": token,
            "message": "Login realizado com sucesso!"
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Erro no login: {str(e)}")

@app.post("/api/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    try:
        code = create_password_reset_code(req.email)
        result = send_password_reset_email(req.email, code)
        return {
            "success": True,
            "dev_code": result.get("dev_code"),
            "message": f"Código de verificação enviado para {req.email}."
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Erro na recuperação: {str(e)}")

@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    try:
        reset_password_with_code(req.email, req.code, req.new_password)
        return {
            "success": True,
            "message": "Sua senha foi redefinida com sucesso! Você já pode fazer login."
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Erro ao redefinir senha: {str(e)}")

@app.post("/api/auth/verify-token")
def auth_verify(user: dict = Depends(verify_google_token)):
    return {
        "authenticated": True,
        "user": user
    }

@app.post("/api/parse", response_model=ParseResponse)
async def parse_attendance(
    tecnico_name: str = Form("Matheus Morato"),
    custom_instructions: Optional[str] = Form(""),
    files: Optional[List[UploadFile]] = File(None),
    text_content: Optional[str] = Form(""),
    user: dict = Depends(verify_google_token)
):
    try:
        images: List[Image.Image] = []
        combined_text = text_content or ""

        if files:
            for file in files:
                filename = file.filename.lower()
                content = await file.read()

                if filename.endswith(".zip"):
                    zip_text, zip_imgs = process_whatsapp_zip(content)
                    combined_text += f"\n{zip_text}"
                    images.extend(zip_imgs)
                elif filename.endswith((".png", ".jpg", ".jpeg", ".webp")):
                    image = Image.open(io.BytesIO(content))
                    images.append(image)
                    try:
                        import pytesseract
                        ocr_text = pytesseract.image_to_string(image, lang='por+eng')
                        if ocr_text and ocr_text.strip():
                            combined_text += f"\n--- [Texto da Imagem (OCR PT/EN): {file.filename}] ---\n{ocr_text.strip()}\n"
                    except Exception:
                        pass
                elif filename.endswith(".txt"):
                    combined_text += f"\n{content.decode('utf-8', errors='ignore')}"

        if not combined_text and not images:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Por favor, envie ao menos uma imagem (print) ou arquivo de texto/ZIP contendo a conversa."
            )

        record = parse_attendance_from_content(
            text_content=combined_text,
            images=images,
            tecnico_name=tecnico_name,
            custom_instructions=custom_instructions
        )

        extracted_names = extract_all_person_names(combined_text, tecnico_name)
        extracted_dates = extract_all_dates_from_chat(combined_text)

        return ParseResponse(
            success=True,
            record=record,
            extracted_names=extracted_names,
            extracted_dates=extracted_dates,
            raw_chat_text=combined_text
        )

    except Exception as e:
        return ParseResponse(
            success=False,
            error=str(e)
        )

@app.post("/api/ai/regenerate-field")
def regenerate_field(req: RegenerateFieldRequest, user: dict = Depends(verify_google_token)):
    try:
        new_text = regenerate_field_content(
            field_name=req.field_name,
            current_value=req.current_value,
            raw_chat_text=req.raw_chat_text or "",
            user_instruction=req.user_instruction or "",
            assunto=req.assunto or "SETE"
        )
        extracted_names = extract_all_person_names_with_gemini(req.raw_chat_text or "")

        extracted_dates = extract_all_dates_from_chat(req.raw_chat_text or "")
        
        blacklisted = ["cargo que ocupa", "cargo que", "cargo", "tipo de vínculo", "cacs", "gestor municipal", "nome completo"]
        clean_extracted_names = [n for n in extracted_names if not any(bl in n.lower() for bl in blacklisted)]

        if req.field_name == "atendido_nome":
            if new_text and any(bl in new_text.lower() for bl in blacklisted):
                new_text = clean_extracted_names[0] if clean_extracted_names else "Gestor Municipal"
            elif new_text and new_text != "Gestor Municipal" and new_text not in clean_extracted_names:
                clean_extracted_names.insert(0, new_text)

        return {
            "success": True,
            "field_name": req.field_name,
            "generated_text": new_text,
            "extracted_names": clean_extracted_names,
            "extracted_dates": extracted_dates
        }

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Erro ao regenerar com IA: {str(e)}")


class ResumoOptionsRequest(BaseModel):
    raw_chat_text: Optional[str] = ""
    assunto: Optional[str] = "SETE"
    current_value: Optional[str] = ""

@app.post("/api/ai/resumo-options")
def get_resumo_options(req: ResumoOptionsRequest, user: dict = Depends(verify_google_token)):
    try:
        options = generate_resumo_options_with_gemini(
            raw_chat_text=req.raw_chat_text or "",
            assunto=req.assunto or "SETE",
            current_value=req.current_value or ""
        )
        return { "success": True, "options": options }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Erro ao gerar opções de resumo: {str(e)}")


@app.get("/api/sheets/next-row")
def get_next_row_info(user: dict = Depends(verify_google_token)):
    try:
        info = get_next_empty_row_info()
        return {
            "success": True,
            "next_row": info["next_row"],
            "total_rows": info["total_rows"]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao consultar planilha: {str(e)}"
        )

@app.get("/api/sheets/check-row/{target_row}")
def check_row_availability(target_row: int, user: dict = Depends(verify_google_token)):
    try:
        status_info = check_row_status(target_row)
        return {
            "success": True,
            "target_row": status_info["target_row"],
            "is_empty": status_info["is_empty"],
            "preview": status_info["preview"]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao verificar linha {target_row}: {str(e)}"
        )

@app.get("/api/training/participants")
def fetch_municipio_training_participants(municipio: str, uf: Optional[str] = "", user: dict = Depends(verify_google_token)):
    try:
        participants = get_all_training_participants_for_municipio(municipio, uf or "")
        return {
            "success": True,
            "municipio": municipio,
            "uf": uf,
            "count": len(participants),
            "participants": participants
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar participantes da capacitação: {str(e)}"
        )

@app.post("/api/sheets/append")
def insert_to_sheets(
    req: SheetAppendRequest,
    authorization: Optional[str] = Header(None),
    user: dict = Depends(verify_google_token)
):
    try:
        user_email = user.get("email", "usuario@cecate.ufg.br")
        target_r = req.target_row or 580

        # 1. Garantia 100% de gravação no Banco de Dados SQLite local
        db_id = save_attendance_to_db(req.record, target_r, user_email)

        # 2. Aprendizado Contínuo para a IA
        try:
            save_ai_training_example(
                user_email=user_email,
                assunto=req.record.assunto,
                approved_resumo=req.record.resumo_demanda,
                approved_observacoes=req.record.observacoes
            )
        except Exception as e_train:
            print(f"[Aviso Treinamento IA]: {e_train}")

        # 3. Tentar sincronização com o Google Sheets se disponível
        raw_token = ""
        if authorization and authorization.startswith("Bearer "):
            raw_token = authorization.split("Bearer ")[1].strip()

        result = insert_attendance_record(
            req.record, 
            target_row=target_r,
            user_access_token=raw_token,
            webhook_url=req.webhook_url
        )

        msg = f"Registro salvo com sucesso no Banco de Dados (Linha {result['inserted_row']})!"
        if result.get("sheets_synced"):
            msg = f"Registro sincronizado com sucesso na Linha {result['inserted_row']} do Google Sheets e no Banco de Dados!"

        return {
            "success": True,
            "db_id": db_id,
            "message": msg,
            "data": result
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao registrar atendimento: {str(e)}"
        )

@app.get("/api/sheets/export-csv")
def export_attendances_csv():
    """Gera o arquivo CSV com todos os atendimentos registrados para download instantâneo."""
    records = get_all_attendances()
    
    headers = [
        "CECATE Responsável", "Iniciativa", "Técnico", "Meio de Contato", "Data Atendimento",
        "Assunto", "Resumo Demanda", "UF", "Município", "Capacitação Participou",
        "Capacitação Local", "Capacitação Data", "Atendido Nome", "Atendido Telefone",
        "Atendido Cargo", "Município Respondeu", "Situação", "Observações", "Linha Planilha"
    ]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)

    for r in records:
        writer.writerow([
            r.get("cecate_responsavel", "CECATE CO"),
            r.get("iniciativa", "Município"),
            r.get("tecnico", ""),
            r.get("meio_contato", "Whats App"),
            r.get("data_atendimento", ""),
            r.get("assunto", "SETE"),
            r.get("resumo_demanda", ""),
            r.get("uf", "GO"),
            r.get("municipio", ""),
            r.get("capacitacao_participou", "Não"),
            r.get("capacitacao_local", ""),
            r.get("capacitacao_data", ""),
            r.get("atendido_nome", ""),
            r.get("atendido_telefone", ""),
            r.get("atendido_cargo", "Gestor"),
            r.get("municipio_respondeu", "Sim"),
            r.get("situacao", "Resolvida"),
            r.get("observacoes", ""),
            r.get("target_row", "")
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=atendimentos_cecate_fnde.csv"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
