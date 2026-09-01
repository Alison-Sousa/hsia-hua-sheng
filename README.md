# Dashboard do acervo Hsia Hua Sheng

Este diretório contém um site de consulta pronto para publicação no Netlify. Ele lê os registros reconciliados, apresenta a volumetria por fonte e abre cada número nos itens que formam aquela contagem.

## Atualizar os dados

Na raiz do projeto, execute:

```powershell
py codigos/gerar_dashboard_estatico.py
py codigos/gerar_exportacoes_dashboard.py
```

A primeira etapa recria `data/dashboard.json` a partir de `paineis/painel_itens.csv` e `paineis/painel_volumetria.csv`. A segunda gera os CSVs e o Excel disponíveis para consulta.

Para tentar recuperar créditos nominais presentes nos metadados das páginas oficiais, sem busca ampla:

```powershell
py codigos/gerar_dashboard_estatico.py --atualizar-creditos
```

Os créditos editoriais ficam em `data/creditos_editoriais.json`. Eles aparecem como “Reportagem”, “Entrevista” ou “Produção”; não substituem a autoria intelectual de Hsia.

## Revisar pelo site

A revisão é aberta e automática, sem login ou senha. Qualquer visitante pode:

- adicionar uma publicação;
- editar os dados de uma publicação existente;
- remover ou restaurar uma publicação;
- baixar a base completa em XLSX ou as publicações em CSV.

Cada alteração é gravada em `data/revisoes_aprovadas.json` no GitHub. O workflow `.github/workflows/dashboard-revisoes.yml` recompõe automaticamente os CSVs, o JSON do painel e o Excel.

O **github-actions[bot]** é a automação do GitHub responsável por manter o acervo sincronizado e atualizado automaticamente.

Para ativar a gravação automática, crie no Netlify a variável secreta `GITHUB_TOKEN` com um token fine-grained do GitHub limitado ao repositório `Alison-Sousa/hsia-hua-sheng` e com permissão **Contents: Read and write**. Depois, faça um novo deploy. O token nunca é enviado ao navegador.
## Publicar no Netlify

Use `.` como diretório de publicação e deixe o comando de build vazio. Também é possível arrastar esta pasta para um deploy manual. Não há banco de dados, login nem dependência no navegador.

## Estrutura

- `index.html`: página principal;
- `assets/`: aparência e interação;
- `data/dashboard.json`: dados usados na tela;
- `data/painel_itens.csv`: manifestações revisadas;
- `data/painel_volumetria.csv`: contagens revisadas;
- `data/acervo_hsia_atualizado.xlsx`: planilha com publicações, volumetria e histórico;
- `data/revisoes_aprovadas.json`: alterações incorporadas pela automação.
