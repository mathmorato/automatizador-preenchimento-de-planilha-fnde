import urllib.request
import json
import os
import gzip

url = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req, timeout=30)
content = resp.read()
if content.startswith(b'\x1f\x8b'):
    content = gzip.decompress(content)

data = json.loads(content.decode('utf-8'))

m_por_uf = {}
for m in data:
    uf = None
    if isinstance(m, dict):
        reg = m.get('regiao-intermediaria') or {}
        if isinstance(reg, dict):
            uf_obj = reg.get('UF') or {}
            if isinstance(uf_obj, dict):
                uf = uf_obj.get('sigla')
        if not uf:
            micro = m.get('microrregiao') or {}
            if isinstance(micro, dict):
                meso = micro.get('mesorregiao') or {}
                if isinstance(meso, dict):
                    uf_obj = meso.get('UF') or {}
                    if isinstance(uf_obj, dict):
                        uf = uf_obj.get('sigla')
        nome = m.get('nome')
        if uf and nome:
            m_por_uf.setdefault(uf, []).append(nome)

for k in m_por_uf:
    m_por_uf[k].sort()

out_path = r"c:\Antigravity\automatizador-preenchimento-de-planilha-fnde\frontend\src\data\municipios.json"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(m_por_uf, f, ensure_ascii=False, indent=2)

print(f"Sucesso! Total UFs: {len(m_por_uf)}, Total Municipios: {sum(len(v) for v in m_por_uf.values())}")
