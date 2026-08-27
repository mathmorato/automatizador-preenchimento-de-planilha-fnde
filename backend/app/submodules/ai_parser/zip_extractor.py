import io
import zipfile
from typing import Tuple, List, Dict
from PIL import Image

def process_whatsapp_zip(zip_bytes: bytes) -> Tuple[str, List[Image.Image]]:
    """
    Processa um arquivo .zip exportado do WhatsApp.
    Retorna uma tupla contendo: (texto_do_chat, lista_de_imagens_pil)
    """
    chat_text = ""
    images: List[Image.Image] = []
    
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        filenames = z.namelist()
        
        # Procurar arquivo de texto principal (_chat.txt ou qualquer .txt)
        txt_files = [f for f in filenames if f.endswith(".txt")]
        if txt_files:
            # Preferência para _chat.txt se existir
            main_txt = next((f for f in txt_files if "_chat" in f.lower()), txt_files[0])
            with z.open(main_txt) as f:
                chat_text = f.read().decode("utf-8", errors="ignore")
                
        # Coletar até 5 imagens anexas
        img_extensions = ('.png', '.jpg', '.jpeg', '.webp')
        img_files = [f for f in filenames if f.lower().endswith(img_extensions)]
        
        for img_name in img_files[:5]:
            try:
                with z.open(img_name) as f:
                    img_data = f.read()
                    image = Image.open(io.BytesIO(img_data))
                    images.append(image)
            except Exception:
                continue
                
    return chat_text, images
