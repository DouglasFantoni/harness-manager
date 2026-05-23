# Hook: Post-Task

> weight: ~200 | bloqueia: não
> Executar após concluir qualquer task.

## 1. Validação técnica

- [ ] Rodei os comandos relevantes? (`typecheck` obrigatório, `lint` e `test` se aplicável)
- [ ] O output bate com o critério de sucesso declarado no `pre-task`?

## 2. Captura de conhecimento

Algo novo foi aprendido? Identifique a categoria e registre:

| Aprendizado | Destino |
|-------------|---------|
| Erro que aconteceu e como resolver | `memory/mistakes.md` |
| Padrão que funcionou bem | `memory/patterns.md` |
| Decisão arquitetural tomada | `memory/decisions.md` |
| Termo novo do domínio | `core/glossary.md` |
| Skill desatualizada ou incompleta | `harness proposals propose` → `evolution/proposed/` |

> Não force uma entrada se não houve aprendizado genuíno.
> Uma entrada vazia é melhor que ruído.

## 3. Registro em `evolution/feedback.md`

Sempre que a task envolver skill ou command, registre (preferir CLI quando possível):

```bash
harness feedback add --task "..." --outcome success --confidence 4 --skill <nome> --command </cmd>
```

Ou append manual:

```yaml
- date: YYYY-MM-DD
  task: descrição curta
  skill_used: nome-da-skill ou null
  command_used: /comando ou null
  outcome: success | partial | failed
  confidence: 1-5
  notes: opcional
```

## 4. Sugestão de evolução

Se o passo 2 gerou entradas → sugira ao usuário rodar `/harness-update`.
Nunca aplique mudanças no harness automaticamente.

## 5. Trace de execução

Verifique se `.harness/evolution/traces/.recording` existe.

Se existir:
1. Leia `.harness/evolution/traces/_template.json`
2. Preencha todos os campos com o que aconteceu nesta task:
   - `id` e `timestamp`: data/hora atual no formato `YYYY-MM-DDTHH-MM-SS`
   - `tool`: `"cursor"` | `"claude-code"` | `"copilot"`
   - `task`: descrição curta da task executada
   - `skills_loaded`: lista das skills carregadas nesta sessão
   - `hooks_fired`: hooks que dispararam (incluindo este)
   - `commands_run`: comandos de validação executados (typecheck, lint, test)
   - `files_modified`: arquivos criados ou editados
   - `errors_encountered`: erros que apareceram durante a execução
   - `resolution`: como o erro principal foi resolvido (string vazia se sem erros)
   - `revisions_needed`: quantas tentativas foram necessárias até o resultado final
   - `outcome`: `"success"` | `"partial"` | `"failed"`
   - `typecheck_passed`: `true` | `false` | `null` (se não rodou)
   - `tests_passed`: `true` | `false` | `null` (se não rodou)
   - `notes`: observações livres (opcional)
3. Salve em `.harness/evolution/traces/{timestamp}-{task-slug}.json`
   onde `task-slug` é 2-4 palavras da task em kebab-case

Se não existir, pule esta seção silenciosamente.

> Campos que não conseguir determinar: use `null` para booleanos, `[]` para arrays, `""` para strings.
> Nunca invente valores.
