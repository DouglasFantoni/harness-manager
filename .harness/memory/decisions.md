# Architectural Decision Records

> Decisões arquiteturais do projeto. Adicione entradas via `/harness-update` ou manualmente.
> A IA deve consultar este arquivo antes de qualquer decisão que envolva estrutura, padrões ou tecnologia.

## Formato de entrada

```markdown
## #{ancora} — {Título}
**Data**: YYYY-MM
**Contexto**: Por que a decisão foi necessária.
**Decisão**: O que foi decidido.
**Consequências**: O que muda a partir disso. O que fica proibido.
**Revisão**: Quando ou sob quais condições esta decisão pode ser reconsiderada.
```

---

<!-- Adicione suas decisões abaixo. -->

## #single-package — Pacote único ao invés de monorepo

**Data**: 2025-05  
**Contexto**: Projeto começou como monorepo (`packages/cli` + `packages/sync`) mas adicionava fricção desnecessária antes de ter usuários reais.  
**Decisão**: Consolidar tudo em um único pacote `@ai-harness/cli` que expõe tanto o binário quanto a API pública como lib.  
**Consequências**: Versão única para CLI e lib. Separar novamente só se houver necessidade real de versionamento independente.  
**Revisão**: Quando o sync for consumido como lib por outros pacotes do ecossistema.

## #scaffold-path — Path do scaffold relativo ao dist compilado

**Data**: 2025-05  
**Contexto**: `src/commands/init.ts` usa `import.meta.url` para localizar o scaffold.  
**Decisão**: Path é `../../scaffold` a partir de `dist/commands/init.js` — sobe 2 níveis para a raiz do pacote.  
**Consequências**: Se a estrutura de `dist/` mudar de profundidade, este path precisa ser ajustado.  
**Revisão**: Nunca mover `init.ts` para subdiretórios mais profundos sem atualizar o path.
