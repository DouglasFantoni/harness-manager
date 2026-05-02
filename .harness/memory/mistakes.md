# Armadilhas Conhecidas

> Erros que já aconteceram neste projeto e como resolvê-los.
> A IA deve verificar este arquivo antes de executar qualquer task.
> Adicione entradas via `/harness-update` ou manualmente após resolver um problema.

## Formato de entrada

```markdown
## [YYYY-MM] {Título curto e descritivo}
**Problema**: O que acontecia de errado e em qual contexto.
**Causa raiz**: Por que acontecia.
**Solução correta**: Como resolver corretamente.
**Referência**: `skills/{domain}/SKILL.md#{ancora}` (se aplicável)
```

---

<!-- Adicione as armadilhas do seu projeto abaixo. -->

## [2025-05] Scaffold path com 3 níveis ao invés de 2

**Problema**: `resolve(__dirname, '../../../scaffold')` em `src/commands/init.ts` subia 3 níveis a partir de `dist/commands/`, saindo fora do pacote.  
**Causa raiz**: Confusão sobre a profundidade do arquivo compilado no `dist/`.  
**Solução correta**: `resolve(__dirname, '../../scaffold')` — 2 níveis sobem de `dist/commands/` para a raiz do pacote onde `scaffold/` está.  
**Referência**: `memory/decisions.md#scaffold-path`

## [2025-05] Arrays de detecção retornando `false | string` 

**Problema**: Padrão `has('dep') && 'valor'` em arrays TypeScript retorna `false | string`, incompatível com `string[]`.  
**Causa raiz**: TypeScript infere `boolean & string` = `never` em alguns contextos.  
**Solução correta**: Helper `pick(condition: boolean, value: string): string | undefined` + `.filter((x): x is string => x !== undefined)`.  
**Referência**: `skills/detector/SKILL.md`
