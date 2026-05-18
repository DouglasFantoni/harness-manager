# Skill: Self-Update

## Meta

```yaml
domain: harness
weight: ~400
exposes_command: ["/harness-update"]
required_by: []
load_with: []
conflicts_with: []
```

## Quando usar

Apenas quando o usuário invoca explicitamente `/harness-update`.
Esta skill nunca é carregada como efeito colateral de outra task.

## Quando NÃO usar

- Durante qualquer outra task
- No `post-task` automático — apenas sugerir ao usuário que rode o comando
- Se o usuário não confirmou explicitamente que quer evoluir o harness

## Contexto essencial

O harness evolui por ação explícita do usuário, nunca automaticamente.
Todo aprendizado passa por aprovação antes de ser aplicado.
O ciclo é: propor diff → `evolution/proposed/` → aguardar aprovação → `harness proposals apply` → sync.

## Regras

- NUNCA executar como efeito colateral de outra task
- NUNCA ler o projeto inteiro — use targets cirúrgicos e específicos
- SEMPRE apresentar o diff antes de qualquer escrita
- SEMPRE salvar propostas em `evolution/proposed/{YYYY-MM-DD}-{arquivo}.md` antes de aplicar
- SEMPRE aguardar confirmação humana explícita antes de escrever qualquer arquivo
- Após aprovação e aplicação, sempre rodar `harness sync`

## O que esta skill pode tocar

✅ `skills/{domain}/SKILL.md` — atualizar exemplos e regras  
✅ `skills/_index.md` — registrar nova skill  
✅ `memory/mistakes.md` — adicionar entradas  
✅ `memory/patterns.md` — adicionar entradas  
✅ `memory/decisions.md` — adicionar entradas  
✅ `core/glossary.md` — adicionar termos  
✅ `commands/_index.md` — registrar novo comando  
✅ `commands/shared/` — adicionar novo comando  
✅ `evolution/changelog.md` — registrar mudança  

## O que esta skill NUNCA pode tocar

❌ `harness.config.json` — alteração humana apenas  
❌ `project-details.json` — alteração humana apenas  
❌ `core/rules.md` — alteração humana apenas  
❌ `adapters/` — gerado pelo sync, nunca diretamente  
❌ Qualquer arquivo fora de `.harness/`  

## Checklist de execução

1. - [ ] Identifiquei exatamente qual arquivo será alterado?
2. - [ ] Gerei o diff proposto?
3. - [ ] Salvei em `evolution/proposed/{YYYY-MM-DD}-{arquivo}.md`?
4. - [ ] Aguardei aprovação explícita?
5. - [ ] Apliquei apenas o que foi aprovado?
6. - [ ] Registrei em `evolution/changelog.md`?
7. - [ ] Rodei `harness sync`?
