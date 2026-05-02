# Skills Registry

> Adicione uma linha aqui para cada skill criada em `skills/{domain}/SKILL.md`.
> O sync usa este arquivo para mapear skills a commands e calcular budget de contexto.

| Skill | Domínio | Peso ~ | Expõe Command | Carregada por |
|-------|---------|--------|---------------|---------------|
| _self-update | harness | ~400 | `/harness-update` | — |

<!-- Adicione suas skills abaixo. Exemplo:
| minha-skill | backend | ~800 | — | /review, /audit |
-->

## Regra de carregamento

A IA deve:
1. Identificar o domínio do arquivo ou task atual
2. Carregar apenas a skill correspondente
3. Verificar se `load_with` sugere skill complementar
4. Garantir que a soma dos pesos não ultrapasse **40% do `context_tokens_est`** da tool ativa

## Criando uma nova skill

1. Copie `skills/_template/SKILL.md` para `skills/{domain}/SKILL.md`
2. Preencha todos os campos do template
3. Adicione uma linha neste arquivo
4. Rode `harness sync` para atualizar os adapters
