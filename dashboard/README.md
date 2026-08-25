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

As inclusões e remoções ficam no navegador até serem exportadas. Na área **Revisão**, é possível:

- marcar ou restaurar uma manifestação;
- acrescentar uma publicação com fonte, formato, URL e evidência;
- comparar a base publicada com a revisão;
- baixar `painel_itens_atualizado.csv`, `acervo_hsia_atualizado.xlsx` ou `revisoes_dashboard.json`.

Para registrar a revisão no repositório, substitua `data/revisoes_aprovadas.json` pelo JSON baixado e envie a mudança ao GitHub. O workflow `.github/workflows/dashboard-revisoes.yml` recompõe automaticamente os CSVs e o Excel. A base original em `paineis/` não é alterada silenciosamente.

## Publicar no Netlify

Use `dashboard` como diretório de publicação e deixe o comando de build vazio. Também é possível arrastar esta pasta para um deploy manual. Não há banco de dados, login nem dependência no navegador.

## Estrutura

- `index.html`: página principal;
- `assets/`: aparência e interação;
- `data/dashboard.json`: dados usados na tela;
- `data/painel_itens.csv`: manifestações revisadas;
- `data/painel_volumetria.csv`: contagens revisadas;
- `data/acervo_hsia_atualizado.xlsx`: planilha com publicações, volumetria e histórico;
- `data/revisoes_aprovadas.json`: alterações incorporadas pela automação.
