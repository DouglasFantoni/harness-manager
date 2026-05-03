# Prompt: Enriquecer configuração inicial

> Copie tudo abaixo desta linha e cole na sua IA preferida.
> Siga as instruções inline para coletar o contexto necessário.

---

Você é um assistente técnico configurando o AI Harness Framework no projeto **{{project.name}}**.

O detector automático preencheu os dados básicos, mas preciso que você analise
o projeto e enriqueça os campos que ele não conseguiu inferir.

## Contexto do projeto

**project-details.json atual:**
```json
{{harness.project_details}}
```

**Estrutura de pastas** (rode e cole o output):
```bash
find . -not -path '*/node_modules/*' -not -path '*/.git/*' \
       -not -path '*/.next/*' -not -path '*/dist/*' \
       -not -path '*/coverage/*' -not -path '*/.harness/*' \
       -maxdepth 4 | sort
```

**Últimos 30 commits** (rode e cole o output):
```bash
git log --oneline -30
```

**Entry points detectados** — cole o conteúdo de cada arquivo:
{{harness.entry_points_list}}

## O que preciso que você faça

Retorne um JSON completo no mesmo schema do `project-details.json` acima,
preenchendo ou melhorando os seguintes campos:

1. **`project.description`** — descrição clara do que o projeto faz (1-2 frases)

2. **`conventions.branch_pattern`** — analise os commits e infira o padrão
   (ex: `"feat|fix|chore/{descricao}"`)

3. **`context_hints.critical_files`** — os 5-10 arquivos mais importantes:
   os mais importados, as configurações centrais, a lógica de negócio crítica

4. **`context_hints.entry_points`** — verifique e complete os entry points

**Regras:**
- Não invente informação que não esteja nos dados fornecidos
- Para campos que não conseguir inferir, mantenha o valor atual
- Retorne APENAS o JSON, sem texto adicional

## O que fazer com o output

1. Revise o JSON retornado
2. Salve em `.harness/project-details.json`
3. Rode: `{{commands.sync}}`
