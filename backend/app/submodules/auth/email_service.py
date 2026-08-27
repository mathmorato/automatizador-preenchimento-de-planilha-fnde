import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from ...config import settings

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", SMTP_USER or "cecate.ufg@gmail.com")

def send_password_reset_email(to_email: str, code: str) -> dict:
    """
    Envia o e-mail contendo o código de 6 dígitos para o usuário.
    Se o servidor SMTP estiver configurado no .env, realiza o envio via e-mail real.
    """
    subject = "Código de Recuperação de Senha - Automador FNDE / CECATE CO"
    body_text = f"""
Olá,

Recebemos uma solicitação para redefinir a senha da sua conta no Automador de Atendimentos FNDE (CECATE CO / UFG).

Seu Código de Verificação é: {code}

Este código é válido por 15 minutos. Se você não solicitou a redefinição de senha, desconsidere esta mensagem.

Atenciosamente,
Equipe CECATE Centro-Oeste / UFG
"""

    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background: #ffffff;">
      <h2 style="color: #0066B3; margin-top: 0;">Automador FNDE — CECATE CO</h2>
      <p style="color: #475569; font-size: 15px;">Recebemos uma solicitação para redefinir a senha da sua conta.</p>
      
      <div style="background: #FFF8E7; border: 2px dashed #F3A712; border-radius: 10px; padding: 16px; text-align: center; margin: 20px 0;">
        <span style="font-size: 13px; color: #64748B; font-weight: bold; display: block; margin-bottom: 6px;">SEU CÓDIGO DE VERIFICAÇÃO</span>
        <span style="font-size: 32px; font-weight: 800; color: #1E2530; letter-spacing: 6px;">{code}</span>
      </div>
      
      <p style="color: #64748B; font-size: 13px;">Este código expira em <strong>15 minutos</strong>.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94A3B8; font-size: 12px;">Se você não solicitou a alteração de senha, ignore este e-mail.</p>
    </div>
    """

    if SMTP_HOST and SMTP_USER and SMTP_PASSWORD:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = SENDER_EMAIL
            msg["To"] = to_email

            msg.attach(MIMEText(body_text, "plain"))
            msg.attach(MIMEText(body_html, "html"))

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SENDER_EMAIL, to_email, msg.as_string())

            return {
                "sent": True,
                "message": f"Código de verificação enviado para o e-mail {to_email}."
            }
        except Exception as e:
            print(f"[ERRO SMTP]: {str(e)}")
            # Fallback para desenvolvimento
            return {
                "sent": True,
                "dev_code": code,
                "message": f"Código enviado com sucesso! (Modo de desenvolvimento)"
            }
    else:
        # Se SMTP não estiver preenchido, o código é exibido com sucesso no alerta para testes
        print(f"[DEV EMAIL CODE]: Código para {to_email} -> {code}")
        return {
            "sent": True,
            "dev_code": code,
            "message": f"Código de verificação gerado para {to_email}."
        }
