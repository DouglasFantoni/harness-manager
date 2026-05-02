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
| Skill desatualizada ou incompleta | Propor diff em `evolution/proposed/` |

> Não force uma entrada se não houve aprendizado genuíno.
> Uma entrada vazia é melhor que ruído.

## 3. Registro em `evolution/feedback.md`

Sempre que a task envolver skill ou command, registre:

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
