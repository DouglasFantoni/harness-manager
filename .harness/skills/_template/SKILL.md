# Skill: {Nome}

> Copie este arquivo para `skills/{domain}/SKILL.md` e preencha todos os campos.
> Depois adicione uma entrada em `skills/_index.md` e rode `harness sync`.

## Meta

```yaml
domain: ""              # backend | frontend | infra | fiscal | domínio | harness
weight: ~000            # estimativa de tokens quando esta skill está carregada
exposes_command: []     # slash commands que esta skill habilita (ex: ["/calc-payroll"])
required_by: []         # commands que sempre carregam esta skill (ex: ["/review", "/audit"])
load_with: []           # skills complementares que fazem sentido junto
conflicts_with: []      # skills que NÃO devem ser carregadas simultaneamente
```

## Quando usar

<!-- 2–3 frases. Objetivo: ajudar o _index.md a decidir se carrega ou não.
     Seja específico sobre o tipo de arquivo ou task que dispara esta skill. -->

## Quando NÃO usar

<!-- Armadilhas de over-use. Evita que a IA carregue a skill errada.
     Ex: "Para lógica de emissão fiscal, use a skill 'fiscal', não esta." -->

## Contexto essencial

<!-- O mínimo que a IA precisa saber para usar esta skill corretamente.
     Seja cirúrgico — cada linha aqui custa tokens em toda sessão que carregar esta skill.
     Referencie arquivos críticos, pacotes canônicos e padrões-chave. -->

## Regras

<!-- Inegociáveis. Use linguagem imperativa.
     Ex:
     - Sempre use o tipo `XyzResult` de `packages/shared-types`
     - Nunca reimplemente a lógica do pacote canônico `packages/xyz`
     - Antes de alterar migrations, verifique `memory/decisions.md#migrations`
-->

## Padrões

<!-- Como as coisas devem ser feitas neste domínio.
     Referencie exemplos em examples/good/ ao invés de repetir código aqui.
     Ex: "Ver `examples/good/correct-usage.ts` para implementação correta." -->

## Checklist de execução

- [ ] ...
- [ ] ...
- [ ] Typecheck passando após as alterações?

## Referências

<!-- Links para decisões, armadilhas e commands relacionados.
     Ex:
     - `memory/decisions.md#{ancora}`
     - `memory/mistakes.md#{ancora}`
     - `commands/shared/{comando}.md`
-->
