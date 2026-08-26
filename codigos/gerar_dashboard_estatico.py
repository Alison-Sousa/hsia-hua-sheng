#!/usr/bin/env python3
"""Gera data/dashboard.json a partir dos painéis reconciliados."""
from __future__ import annotations
import argparse, csv, html, json, re, sys, unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from livro_dashboard import build_book_payload

ROOT=Path(__file__).resolve().parents[1]
ITEMS=ROOT/"paineis"/"painel_itens.csv"; VOLUME=ROOT/"paineis"/"painel_volumetria.csv"
NLP=ROOT/"paineis"/"painel_nlp.csv"; UPDATES=ROOT/"paineis"/"painel_dados_atualizaveis.csv"
OUTDIR=ROOT/"data"; OUT=OUTDIR/"dashboard.json"; BOOK_OUT=OUTDIR/"livro.json"; CREDITS=OUTDIR/"creditos_editoriais.json"
CATEGORIES={
 "colunas_autorais":"Colunas autorais","entrevistas_escritas_completas":"Entrevistas escritas",
 "transcricoes_palestras_aulas":"Transcrições e aulas","participacoes_em_reportagens":"Participações em reportagens",
 "casos_relatorios_profissionais":"Casos e relatórios","artigos_profissionais":"Artigos profissionais",
 "artigos_academicos":"Artigos acadêmicos","videos_podcasts":"Vídeos e podcasts","livros_capitulos":"Livros e capítulos"}
AUTHORIAL={"autor_unico","primeiro_autor","coautor","autor_correspondente"}
UNKNOWN={"","desconhecido","desconhecida","nao informado","nao informada","não informado","não informada","n/a","nao_se_aplica"}

def read_csv(path):
 with path.open("r",encoding="utf-8-sig",newline="") as f:
  return [{k:(v or "").strip() for k,v in r.items()} for r in csv.DictReader(f)]
def norm(value):
 value=unicodedata.normalize("NFKD",value or "")
 return "".join(c for c in value if not unicodedata.combining(c)).strip().lower()
def unknown(value): return norm(value) in {norm(v) for v in UNKNOWN} or "desconhecid" in norm(value)
def yes(value): return norm(value) in {"sim","s","true","1","yes"}
def split_urls(value):
 if norm(value) in {"","nenhuma","nao se aplica","nao_se_aplica"}: return []
 return [v.strip() for v in re.split(r"\s*\|\s*|\s*;\s*",value) if v.strip().startswith(("http://","https://"))]

def clean_name(value:Any):
 if isinstance(value,dict): value=value.get("name") or value.get("alternateName") or ""
 if isinstance(value,list): return "; ".join(filter(None,(clean_name(v) for v in value)))
 value=html.unescape(str(value or "")); value=re.sub(r"<[^>]+>"," ",value); value=re.sub(r"\s+"," ",value).strip(" -|,\n\r\t")
 return "" if not value or len(value)>180 or value.lower().startswith(("http://","https://")) else value
def jsonld_names(node):
 found=[]
 if isinstance(node,list):
  for part in node: found+=jsonld_names(part)
 elif isinstance(node,dict):
  for key in ("author","creator"):
   if key in node:
    name=clean_name(node[key])
    if name: found.append(name)
  for key in ("@graph","mainEntity","itemListElement"):
   if key in node: found+=jsonld_names(node[key])
 return found
def extract_credit(page):
 found=[]
 for match in re.finditer(r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",page,re.I|re.S):
  try: found+=jsonld_names(json.loads(html.unescape(match.group(1)).strip()))
  except json.JSONDecodeError: pass
 patterns=(
  r"<meta[^>]+(?:name|property)=[\"'](?:author|article:author|parsely-author|byl)[\"'][^>]+content=[\"']([^\"']+)",
  r"<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:name|property)=[\"'](?:author|article:author|parsely-author|byl)[\"']")
 for pattern in patterns: found+=re.findall(pattern,page,re.I)
 for item in found:
  item=clean_name(item)
  if item and not unknown(item) and not any(x in norm(item) for x in ("google","facebook","whatsapp")): return item
 return ""
def fetch_credit(item_id,url):
 result={"credito":"","url_consultada":url,"status":"nao_localizado","consultado_em":datetime.now(timezone.utc).isoformat()}
 try:
  req=Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; AcervoHsia/1.0)","Accept-Language":"pt-BR,pt;q=0.9,en;q=0.6"})
  with urlopen(req,timeout=12) as response:
   page=response.read(2_000_000).decode(response.headers.get_content_charset() or "utf-8",errors="replace")
  result["credito"]=extract_credit(page); result["status"]="credito_nominal_confirmado" if result["credito"] else "pagina_sem_credito_nominal_detectavel"
 except HTTPError as error: result["status"]=f"http_{error.code}"
 except (URLError,TimeoutError,OSError): result["status"]="acesso_indisponivel"
 return item_id,result
def load_cache():
 try:
  data=json.loads(CREDITS.read_text(encoding="utf-8")); return data.get("items",data)
 except (OSError,json.JSONDecodeError): return {}
def update_cache(rows,cache,limit):
 jobs={}
 for row in rows:
  item_id=row.get("item_id",""); role=norm(row.get("papel_hsia","")); url=row.get("url_original") or row.get("url_principal",""); host=urlparse(url).netloc.lower()
  if len(jobs)>=limit or not item_id or item_id in cache or role in AUTHORIAL or not unknown(row.get("autores","")): continue
  if not url.startswith(("http://","https://")) or any(x in host for x in ("youtube.com","youtu.be","linkedin.com")): continue
  jobs.setdefault(item_id,url)
 with ThreadPoolExecutor(max_workers=5) as pool:
  futures=[pool.submit(fetch_credit,key,url) for key,url in jobs.items()]
  for future in as_completed(futures):
   key,value=future.result(); cache[key]=value
 OUTDIR.mkdir(parents=True,exist_ok=True)
 CREDITS.write_text(json.dumps({"gerado_em":datetime.now(timezone.utc).isoformat(),"items":cache},ensure_ascii=False,indent=2),encoding="utf-8")
 return cache

def credit_fields(row,cache):
 authors=row.get("autores","").strip(); source=row.get("fonte","Fonte não informada"); role=norm(row.get("papel_hsia","")); category=row.get("categoria_painel","")
 nominal=cache.get(row.get("item_id",""),{}).get("credito","").strip(); absent=unknown(authors)
 if role in AUTHORIAL: return "Autoria",("Hsia Hua Sheng" if absent else authors),"Autor ou coautor"
 if role in {"entrevistado","entrevistada"} or category=="entrevistas_escritas_completas":
  editorial=nominal or (authors if not absent and norm(authors)!="hsia hua sheng" else "")
  return "Reportagem ou entrevista",editorial or f"Redação de {source}","Entrevistado: Hsia Hua Sheng"
 if category=="participacoes_em_reportagens":
  editorial=nominal or (authors if not absent and norm(authors)!="hsia hua sheng" else "")
  return "Reportagem",editorial or f"Redação de {source}","Participação de Hsia Hua Sheng"
 if category=="videos_podcasts":
  editorial=nominal or (authors if not absent and norm(authors)!="hsia hua sheng" else "")
  return "Produção",editorial or source,"Participação de Hsia Hua Sheng"
 if role in {"palestrante","participante","speaker"}: return "Participação","Hsia Hua Sheng","Palestrante ou participante"
 return "Crédito",nominal or (authors if not absent else f"Responsabilidade editorial de {source}"),"Registro relacionado a Hsia Hua Sheng"

def build(rows,volumes,cache):
 enriched=[]
 for order,row in enumerate(rows,1):
  item=dict(row); label,credit,participation=credit_fields(row,cache)
  item.update({"rotulo_credito":label,"credito_exibicao":credit,"participacao_hsia":participation,
   "categoria_label":CATEGORIES.get(row.get("categoria_painel",""),row.get("categoria_painel","").replace("_"," ").title()),
   "urls_secundarias_lista":split_urls(row.get("urls_secundarias","")),"contabilizado":yes(row.get("contabilizado_na_volumetria","")),
   "origem_local":False,"ordem_base":order}); enriched.append(item)
 official=[x for x in enriched if x["contabilizado"]]; source_totals={}
 for item in official:
  source=item.get("fonte") or "Fonte não informada"; source_totals[source]=source_totals.get(source,0)+1
 return {"meta":{"gerado_em":datetime.now(timezone.utc).isoformat(),"total_manifestacoes":len(official),"total_registros":len(enriched),
  "total_fontes":len(source_totals),"total_obras":len({x.get("item_id") for x in official if x.get("item_id")}),
  "creditos_nominais_recuperados":sum(bool(v.get("credito")) for v in cache.values())},
  "categorias":[{"id":key,"label":label,"total":sum(x.get("categoria_painel")==key for x in official)} for key,label in CATEGORIES.items()],
  "totais_fontes":source_totals,"volumetria":volumes,"itens":enriched,"config":{"github_new_issue_url":""}}

def main():
 parser=argparse.ArgumentParser(); parser.add_argument("--atualizar-creditos",action="store_true"); parser.add_argument("--limite-creditos",type=int,default=60); args=parser.parse_args()
 if not all(path.exists() for path in (ITEMS,VOLUME,NLP,UPDATES)): print("Painéis obrigatórios ausentes.",file=sys.stderr); return 2
 rows,volumes,cache=read_csv(ITEMS),read_csv(VOLUME),load_cache()
 if args.atualizar_creditos: cache=update_cache(rows,cache,max(args.limite_creditos,0))
 payload=build(rows,volumes,cache); book=build_book_payload(ITEMS,NLP,UPDATES); OUTDIR.mkdir(parents=True,exist_ok=True); OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
 BOOK_OUT.write_text(json.dumps(book,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
 print(f"{OUT.relative_to(ROOT)}: {payload['meta']['total_manifestacoes']} manifestações | {BOOK_OUT.relative_to(ROOT)}: {book['meta']['total_relations']} relações"); return 0
if __name__=="__main__": raise SystemExit(main())
