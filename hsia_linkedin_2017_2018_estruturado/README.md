# Arquivo estruturado — Hsia Hua Sheng / FGV / LinkedIn 2017–2018

Fonte: `0_Total_Colunas Linkedin Hsia 2017 e 2018.docx` (compilação manual fornecida pelo autor).

## Resultado

- Publicações individualizadas: **52**
- Ocorrências duplicadas no DOCX original identificadas e consolidadas: **2**
- Imagens extraídas e vinculadas às respectivas publicações: **69**
- Tabelas Word convertidas também para estrutura JSON e CSV: **2**
- Registros sem data explícita localizada no DOCX: **2**

## Estrutura

- `artigos.json`: todos os registros em um único JSON.
- `artigos.jsonl`: um registro por linha, recomendado para NLP/processamento incremental.
- `indice_artigos.csv`: índice resumido.
- `artigos/NNN_titulo/`: uma pasta por publicação.
  - `artigo.json`: metadados, texto integral, texto limpo para NLP, imagens e tabelas.
  - `conteudo.md`: reprodução textual em ordem, com tabelas e referências às imagens.
  - `texto_nlp.txt`: texto sem autoria/data/boilerplate recorrente, pronto para classificação semântica.
  - `imagens/`: arquivos de imagem extraídos do DOCX e associados ao artigo.
  - `tabelas/`: tabelas estruturadas em CSV quando houver.
- `fonte_original/`: cópia intacta do DOCX usado como fonte/proveniência.

## Datas

As datas foram preservadas exatamente a partir das linhas `Data ...`, `Published on ...` ou, quando necessário, da citação interna do próprio artigo. Nenhuma data foi criada por inferência. Os registros sem data explícita estão marcados com `data_status = nao_localizada_no_docx` para revisão manual.

## Uso posterior

O campo `texto_para_nlp`/arquivo `texto_nlp.txt` é indicado para a nova classificação nos 17 capítulos. O campo `texto_original_completo`, as tabelas e as imagens ficam preservados para revisão editorial e para a etapa posterior de identificação/atualização de dados quantitativos.
