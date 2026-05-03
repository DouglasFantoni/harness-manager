# Skill: Spec Reader

## Meta

```yaml
domain: specs
weight: ~400
exposes_command: ["/spec-check"]
required_by: []
load_with: []
conflicts_with: []
```

## Quando usar

Ao implementar ou revisar código relacionado a uma feature que tem spec
em `specs/{feature}/spec.md`. Sempre que a task mencionar uma feature,
user story, ou critério de aceite.

## Quando NÃO usar

Para tasks sem spec associada — refatorações, correções de bug,
mudanças de infraestrutura que não alteram comportamento de negócio.

## Contexto essencial

- Specs vivem em `.harness/specs/{feature}/spec.md`
- O registry de todas as specs está em `.harness/specs/_index.md`
- Uma spec com `status: draft` não deve ser implementada ainda
- Uma spec com `status: ready` está aprovada para implementação
- Critérios de aceite com `- [ ]` não implementados, `- [x]` implementados
- Cada critério de aceite deve corresponder a pelo menos um caso de teste

## Regras

- Antes de implementar qualquer feature, verificar se existe spec em `specs/_index.md`
- Nunca implementar spec com `status: draft` — reportar ao usuário que a spec não está aprovada
- Cada critério de aceite da spec deve ter pelo menos um teste correspondente
- Após implementação, atualizar os critérios de aceite de `- [ ]` para `- [x]`
- Ao encontrar comportamento não coberto pela spec, questionar antes de implementar
- Regras de negócio da spec têm precedência sobre suposições do desenvolvedor

## Protocolo de implementação

1. Localizar a spec em `specs/_index.md` pelo nome da feature ou domínio
2. Ler `specs/{feature}/spec.md` completo
3. Verificar `status` — se `draft`, parar e avisar
4. Para cada US relevante à task:
   - Ler os critérios de aceite
   - Ler as regras de negócio
   - Verificar perguntas em aberto (se houver, reportar antes de implementar)
5. Implementar cobrindo todos os critérios
6. Marcar critérios implementados como `- [x]`
7. Se todos os critérios de uma US foram cobertos, marcar no `specs/_index.md`

## Protocolo de /spec-check

1. Ler `specs/_index.md` — listar todas as specs com `status: ready` ou `in-progress`
2. Para cada spec, ler os critérios de aceite
3. Buscar nos arquivos de teste se existe cobertura para cada critério
4. Reportar: critérios cobertos ✅, critérios sem cobertura ❌, specs sem nenhum teste ⚠️

## Checklist de execução

- [ ] Spec localizada e lida?
- [ ] Status é `ready` ou `in-progress`?
- [ ] Todos os critérios de aceite relevantes foram implementados?
- [ ] Critérios marcados como `- [x]` após implementação?
- [ ] Testes cobrem cada critério?
- [ ] Perguntas em aberto foram resolvidas ou reportadas?

## Referências

- `specs/_index.md` — registry de features
- `specs/_template.md` — como criar novas specs
- `commands/shared/spec-check.md` — comando de validação
