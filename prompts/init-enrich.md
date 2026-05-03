# Prompt: Enriquecer project-details.json após harness init

## Quando usar

Logo após rodar `harness init`. O detector automático preenche stack e scripts,
mas não consegue inferir descrição, arquivos críticos, padrões de branch e glossário.
Este prompt pede para a IA fazer essa análise.

## Contexto para fornecer à IA

Cole o seguinte junto com o prompt abaixo:

1. **O arquivo `.harness/project-details.json` gerado** (cole o conteúdo)
2. **O `package.json` da raiz** (cole o conteúdo)
3. **A estrutura de pastas** — rode e cole o output:
   ```bash
   find . -not -path '*/node_modules/*' -not -path '*/.git/*' \
          -not -path '*/.next/*' -not -path '*/dist/*' \
          -not -path '*/coverage/*' -maxdepth 4 | sort
   ```
4. **Os últimos 30 commits** — rode e cole o output:
   ```bash
   git log --oneline -30
   ```
5. **Os arquivos de entrada do projeto** — cole o conteúdo dos entry points
   listados em `context_hints.entry_points`

---

## Prompt

```
Você é um assistente técnico analisando um projeto de software para configurar
o AI Harness Framework.

Vou te fornecer:
- O project-details.json atual (gerado automaticamente com dados parciais)
- O package.json da raiz
- A estrutura de pastas do projeto
- Os últimos 30 commits do git
- O conteúdo dos principais arquivos de entrada

Com base nesses dados, preciso que você retorne um JSON completo com os campos
enriquecidos. Siga estritamente o formato do project-details.json existente.

Campos que preciso que você preencha ou melhore:

1. **project.description**: Uma descrição clara e concisa do que o projeto faz
   (1-2 frases, técnica mas legível)

2. **conventions.branch_pattern**: Analise os commits e infira o padrão de
   branches usado (ex: "feat|fix|chore/{descricao}" ou "feature/{ticket}-{descricao}")

3. **context_hints.critical_files**: Liste os 5-10 arquivos mais importantes
   do projeto — os que qualquer desenvolvedor deveria conhecer primeiro.
   Critérios: arquivos mais importados, configurações centrais, entry points
   de módulos principais, arquivos com lógica de negócio crítica.

4. **context_hints.entry_points**: Verifique e complete os entry points — arquivos
   onde a execução começa ou onde a estrutura principal é definida.

Regras:
- Não invente informação que não esteja nos arquivos fornecidos
- Para campos que não conseguir inferir com confiança, mantenha o valor atual
- Retorne APENAS o JSON, sem explicações adicionais
- Mantenha exatamente o mesmo schema do project-details.json fornecido

[COLE AQUI O project-details.json ATUAL]

[COLE AQUI O package.json]

[COLE AQUI A ESTRUTURA DE PASTAS]

[COLE AQUI OS ÚLTIMOS 30 COMMITS]

[COLE AQUI O CONTEÚDO DOS ENTRY POINTS]
```

---

## Após receber o output

1. Compare o JSON gerado com o original — revise o que não fizer sentido
2. Salve o resultado em `.harness/project-details.json`
3. Rode `harness sync`
