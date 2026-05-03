# Skill: Harness Orchestrator

## Meta

```yaml
domain: harness
weight: ~600
exposes_command: ["/setup"]
required_by: []
load_with: []
conflicts_with: ["_self-update"]
```

## Quando usar

Quando o comando `/setup` for invocado — geralmente logo após o `harness init`,
para popular o harness com conteúdo real do projeto usando IA.

## Quando NÃO usar

- Durante tasks normais de desenvolvimento
- Quando o harness já estiver populado e só precisar de ajustes pontuais
  (nesse caso use `/harness-update`)
- Em projetos onde o dev prefere preencher o harness manualmente

## Contexto essencial

Esta skill descreve um padrão de orquestração. O agente que a executa
deve adaptar o padrão às suas capacidades:

- **Claude Code (Task tool disponível)**: pode spawnar sub-agentes paralelos
  para cada etapa, acelerando o processo
- **Cursor / outros**: executa as etapas sequencialmente no mesmo contexto
- **Qualquer tool**: o resultado final deve ser o mesmo — harness populado
  e `harness sync` executado com sucesso

Os prompts são gerados pelo CLI do harness e contêm as instruções detalhadas
para cada etapa. O agente não precisa inferir o que fazer — os prompts
já dizem exatamente.

## Protocolo de execução

### Fase 1 — Reconhecimento (sempre sequencial)

Antes de spawnar qualquer sub-agente, o orquestrador deve:

1. Ler `project-details.json` para entender o projeto
2. Listar arquivos do projeto (1-2 níveis, excluindo `node_modules`, `dist`, `.git`)
3. Identificar os domínios de negócio presentes (ex: pagamentos, autenticação, relatórios)
4. Determinar quais etapas são necessárias (ver Fase 2)

### Fase 2 — Orquestração

Execute cada etapa abaixo. Se sub-agentes estiverem disponíveis, as etapas
marcadas com `[paralelo]` podem ser executadas simultaneamente.

---

#### Etapa A — Glossário `[paralelo]`

```bash
harness prompt glossary-generate
```

O output é um prompt completo. Execute-o com o seguinte contexto adicional:

- Arquivos a fornecer: models, entities, DTOs, interfaces, types do projeto
- Caminho de saída: `.harness/core/glossary.md`
- Instrução pós-processamento: adicionar as entradas geradas ao arquivo existente

---

#### Etapa B — Regras `[paralelo]`

```bash
harness prompt rules-generate
```

O output é um prompt completo. Execute-o com o seguinte contexto adicional:

- Arquivos a fornecer: `tsconfig.json`, configs de eslint/prettier, 2-3 exemplos de código
- Caminho de saída: `.harness/core/rules.md`
- Instrução pós-processamento: substituir o conteúdo do arquivo

---

#### Etapa C — Armadilhas `[paralelo]`

```bash
harness prompt mistakes-extract
```

O output é um prompt completo. Execute-o com o seguinte contexto adicional:

- Contexto a fornecer: `git log --oneline --grep="fix\|bug\|hotfix\|corrige" -50`
- Caminho de saída: `.harness/memory/mistakes.md`
- Instrução pós-processamento: adicionar as entradas ao final do arquivo

---

#### Etapa D — Skills por domínio (sempre sequencial, após A-B-C)

Para cada domínio identificado na Fase 1:

```bash
harness prompt skill-create
```

O output é um prompt. Execute-o com os arquivos do domínio como contexto.

- Caminho de saída: `.harness/skills/{dominio}/SKILL.md`
- Após criar: adicionar entrada em `.harness/skills/_index.md`

---

#### Etapa E — Specs iniciais (sempre sequencial, após D)

Para cada domínio identificado na Fase 1, verificar se já existem features
implementadas sem spec. Se sim, criar specs `status: draft` para documentar
o comportamento atual.

```bash
harness prompt spec-create
```

Forneça como contexto o código existente do domínio.
O objetivo é documentar o que já existe, não especificar novas features.

- Caminho de saída: `.harness/specs/{feature}/spec.md`
- Status inicial: sempre `draft` (revisão humana antes de usar)
- Após criar: adicionar entrada em `.harness/specs/_index.md`

> Se o projeto não tiver features implementadas ainda, pule esta etapa.

---

### Fase 3 — Finalização (sempre sequencial)

Após todas as etapas concluídas:

1. Verificar que todos os arquivos foram salvos corretamente
2. Executar `harness sync`
3. Reportar o que foi criado e o que precisa de revisão humana

### Fase 4 — Revisão

Sempre terminar com um resumo para o desenvolvedor:

```
✅ Criado: core/glossary.md ({n} termos)
✅ Criado: core/rules.md ({n} regras)
✅ Criado: memory/mistakes.md ({n} armadilhas)
✅ Criado: skills/{dominio}/SKILL.md (para cada domínio)
✅ harness sync executado

⚠️  Revisar antes de commitar:
- Verifique se os termos do glossário estão corretos
- Confirme as regras geradas com o time
- Valide as armadilhas extraídas do histórico
```

## Checklist de execução

- [ ] Fase 1 concluída — projeto entendido, domínios identificados
- [ ] Etapa A — glossary.md gerado ou atualizado
- [ ] Etapa B — rules.md gerado ou atualizado
- [ ] Etapa C — mistakes.md gerado ou atualizado
- [ ] Etapa D — skill criada para cada domínio identificado
- [ ] Etapa E — specs draft criadas para features existentes (se aplicável)
- [ ] harness sync executado com sucesso
- [ ] Resumo apresentado ao desenvolvedor

## Notas importantes

- **Nunca sobrescrever conteúdo existente sem verificar** — se o arquivo já tem
  entradas, adicionar ao invés de substituir (exceto `rules.md` que é substituição)
- **Qualidade sobre quantidade** — é melhor gerar menos entradas corretas do que
  muitas entradas genéricas. Instrua os sub-agentes a serem conservadores.
- **O desenvolvedor revisa** — o output desta skill é um rascunho, não um produto final.
  Sempre deixar claro o que precisa de revisão humana.
- **Falha parcial é ok** — se uma etapa falhar, continuar com as demais e reportar
  a falha no resumo final. Não abortar tudo por uma etapa.

## Referências

- `commands/shared/setup.md` — comando que dispara esta skill
- `prompts/` — templates dos prompts usados em cada etapa
- `skills/_self-update/SKILL.md` — para atualizações posteriores ao harness
