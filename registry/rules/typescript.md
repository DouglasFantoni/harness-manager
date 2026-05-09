# Rules: TypeScript

## Meta

```yaml
version: "1.0.0"
category: "typescript"
sync: true
```

## Tipos

- Nunca usar `any` — se necessário, usar `unknown` e narrowing explícito
- Sempre tipar o retorno de funções públicas e exportadas
- Preferir `interface` para contratos de objetos, `type` para unions e aliases
- Usar `satisfies` ao invés de cast quando quiser validar sem perder tipo inferido
- Evitar `as` exceto quando o tipo é genuinamente mais específico que o inferido
- Enums numéricos são proibidos — usar `const` enums ou union de strings literais

## Imports

- Imports de tipo com `import type` — não misturar com imports de valor
- Usar path aliases configurados no `tsconfig.json` — nunca `../../../`
- Imports agrupados: externos → internos → relativos (sem linha em branco entre grupos do mesmo tipo)

## Nullability

- Preferir `undefined` ao invés de `null` em código novo
- Nunca usar `!` (non-null assertion) sem comentário explicando por quê é seguro
- Optional chaining (`?.`) e nullish coalescing (`??`) ao invés de verificações manuais

## Async

- Sempre `await` dentro de `try/catch` — nunca `.catch()` em chains longas
- Nunca `Promise.all` sem tratamento de erro — usar `Promise.allSettled` quando falha parcial é aceitável
- `async/await` ao invés de callbacks ou `.then()/.catch()` em código novo

## Validação

- Sempre rodar `typecheck` antes de considerar uma task concluída
- Erros de tipo nunca são resolvidos com cast — encontrar a causa raiz

## Customizações do projeto

<!-- HARNESS:CUSTOM:START -->
<!-- HARNESS:CUSTOM:END -->
