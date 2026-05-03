# Prompt: Extrair Armadilhas do Histórico

> Copie tudo abaixo desta linha e cole na sua IA preferida.
> Cole o histórico indicado antes de enviar.

---

Você é um assistente técnico extraindo armadilhas conhecidas para o AI Harness
Framework no projeto **{{project.name}}**.

## Armadilhas já documentadas

```markdown
{{harness.mistakes}}
```

## O que preciso

Analise o histórico abaixo e identifique erros reais que aconteceram
para que IAs não os repitam.

Cole aqui o histórico relevante — escolha uma ou mais fontes:

**Opção 1 — commits de fix** (rode e cole o output):
```bash
git log --oneline --grep="fix\|hotfix\|bug\|corrige\|correc" -50
```

**Opção 2 — PRs de bugfix**: Cole descrições e comentários de PRs relevantes

**Opção 3 — logs de erro conhecidos**: Cole mensagens de erro recorrentes

```
[COLE AQUI O HISTÓRICO]
```

## Formato de cada entrada

```markdown
## [YYYY-MM] {Título curto e descritivo}
**Problema**: O que acontecia de errado e em qual contexto.
**Causa raiz**: Por que acontecia.
**Solução correta**: Como resolver ou evitar corretamente.
**Referência**: Arquivo ou skill relacionada (se aplicável)
```

## Critérios para incluir

✅ O erro aconteceu de verdade  
✅ Tem causa raiz identificável  
✅ A solução não é trivialmente óbvia  
✅ Poderia acontecer novamente  

## Critérios para excluir

❌ Erros de ambiente/infra que não se repetem  
❌ Bugs já corrigidos estruturalmente (impossível repetir)  
❌ Não inclua entradas já presentes nas armadilhas atuais acima  

Retorne apenas o Markdown das novas entradas, sem texto adicional.

## O que fazer com o output

1. Revise — confirme que cada entrada é precisa e acionável
2. Adicione ao final de `.harness/memory/mistakes.md`
3. Rode: `{{commands.sync}}`
