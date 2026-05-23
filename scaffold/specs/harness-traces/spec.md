# Feature: Harness Traces

## Metadados

```yaml
id: feat-001
status: ready
domain: evolution
owner: harness-core
created: 2026-05-23
updated: 2026-05-23
```

## Contexto

O `/harness-update` hoje só tem acesso ao `evolution/feedback.md` — um resumo comprimido com `outcome` e `confidence`. Isso limita a qualidade das melhorias propostas porque feedback comprimido remove informação diagnosticamente útil (erros encontrados, comandos que falharam, quantas revisões foram necessárias).

O sistema de traces resolve isso de forma opt-in: quando o usuário ativa a gravação, o `post-task.md` instrui a IA a salvar um JSON estruturado com os detalhes da execução. O `/harness-update` então lê os traces recentes para propor mudanças com base em padrões reais.

O design é agnóstico de tool — Cursor, Claude Code e Copilot usam o mesmo schema JSON e o mesmo `post-task.md`. A diferença está na qualidade de execução de cada tool, não na estrutura dos dados.

## User Stories

### US-01 — Ativar e desativar gravação de traces

**Como** desenvolvedor que quer melhorar o harness
**Quero** ativar a gravação de traces com um comando simples
**Para** coletar dados reais de execução sem custo permanente de tokens

**Critérios de aceite:**
- [ ] `harness trace --record` cria `.harness/evolution/traces/.recording`
- [ ] `harness trace --stop` remove `.harness/evolution/traces/.recording`
- [ ] `harness trace --status` mostra se está ativo, quantos traces existem e o último registrado
- [ ] Rodar `--record` quando já está ativo não cria duplicata nem retorna erro — confirma o estado
- [ ] Rodar `--stop` quando não está ativo retorna mensagem informativa, não erro

**Fora de escopo:**
- Ativação automática sem comando explícito do usuário
- Histórico de quando foi ativado/desativado

---

### US-02 — IA grava trace ao concluir task

**Como** IA executando uma task com gravação ativa
**Quero** saber quando devo gravar um trace e como fazê-lo
**Para** registrar os detalhes da execução sem instrução manual do usuário

**Critérios de aceite:**
- [ ] `post-task.md` contém seção "Trace de execução" que instrui verificar `.recording`
- [ ] Se `.recording` não existe, a seção é ignorada silenciosamente — sem mensagem ao usuário
- [ ] Se `.recording` existe, a IA lê `_template.json`, preenche todos os campos e salva o arquivo
- [ ] Nome do arquivo segue o padrão `{YYYY-MM-DDTHH-MM-SS}-{task-slug}.json`
- [ ] `task-slug` é 2-4 palavras da task em kebab-case
- [ ] O campo `tool` é preenchido corretamente por cada IA (`"cursor"`, `"claude-code"`, `"copilot"`)
- [ ] Campos que a IA não consegue determinar ficam com valor neutro (`null`, `[]`, `""`) — nunca inventados

**Fora de escopo:**
- Validação automática do JSON gerado pelo CLI
- Alerta ao usuário se a IA não gravou o trace esperado

---

### US-03 — Inspecionar traces coletados

**Como** desenvolvedor
**Quero** visualizar os traces coletados
**Para** entender o que foi registrado antes de rodar o `/harness-update`

**Critérios de aceite:**
- [ ] `harness trace --list` exibe tabela com id, tool, task, outcome e data — um trace por linha
- [ ] `harness trace --show <id>` exibe o JSON formatado de um trace específico
- [ ] `harness trace --list` com pasta vazia (sem traces) retorna mensagem informativa, não erro
- [ ] `--list` ordena por data decrescente (mais recente primeiro)
- [ ] `--show` aceita tanto o id completo quanto um prefixo não ambíguo

**Fora de escopo:**
- Filtragem por tool, outcome ou skill
- Exportação para outros formatos

---

### US-04 — Limpar traces

**Como** desenvolvedor
**Quero** apagar os traces coletados
**Para** começar uma nova rodada de coleta ou liberar espaço

**Critérios de aceite:**
- [ ] `harness trace --clear` pede confirmação explícita antes de deletar
- [ ] Após confirmação, remove todos os `.json` da pasta `evolution/traces/`
- [ ] Não remove `_template.json` nem `.recording`
- [ ] Retorna contagem de arquivos removidos

**Fora de escopo:**
- Remoção seletiva por data ou tool
- Backup automático antes de limpar

---

### US-05 — `/harness-update` usa traces quando disponíveis

**Como** IA executando `/harness-update`
**Quero** acesso aos traces recentes antes de propor mudanças
**Para** basear as sugestões em padrões reais de execução, não só no feedback resumido

**Critérios de aceite:**
- [ ] `commands/shared/harness-update.md` contém instrução para verificar `evolution/traces/`
- [ ] Se existirem traces, a IA lê os 10 mais recentes antes de propor mudanças
- [ ] A instrução especifica o que procurar: skills com erros frequentes, comandos que falham, tarefas com múltiplas revisões, resoluções repetidas
- [ ] Se não existirem traces, a instrução é ignorada — o `/harness-update` continua funcionando normalmente com `feedback.md`
- [ ] A instrução limita explicitamente a 10 traces para controlar consumo de tokens

**Fora de escopo:**
- Análise automática de traces pelo CLI
- Score de qualidade de skills baseado em traces

---

## Regras de negócio

- Traces são sempre opt-in — nenhum trace é gerado sem `harness trace --record`
- O schema JSON é compartilhado entre todas as tools — nenhum campo é tool-specific
- A instrução de gravação fica no `post-task.md` como seção estática — não é gerada dinamicamente pelo sync
- O CLI nunca lê nem processa o conteúdo dos traces — só lista, exibe e limpa
- O campo `tool` é o único identificador de qual IA gerou o trace
- Traces são arquivos do projeto — ficam no repositório por padrão (não no `.gitignore`)

## Perguntas em aberto

- [ ] O `.recording` deve conter a data de ativação para o `--status` mostrar "ativo desde YYYY-MM-DD"?
- [ ] O `_template.json` deve ter comentários inline explicando cada campo, ou documentação separada?

## Referências

- `commands/shared/harness-update.md` — comando que consome os traces
- `hooks/post-task.md` — onde a instrução de gravação fica
- `evolution/feedback.md` — feedback resumido que os traces complementam
- Paper: Meta-Harness (arxiv:2603.28052) — motivação para traces estruturados
