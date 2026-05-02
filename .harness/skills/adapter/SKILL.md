# Skill: Adapter

## Meta

```yaml
domain: backend
weight: ~600
exposes_command: []
required_by: ["/review", "/refactor"]
load_with: []
conflicts_with: []
```

## Quando usar

Ao criar, editar ou revisar qualquer adapter em `src/adapters/`.
Adapters transformam o conteúdo do scaffold no formato específico de cada tool de IA.

## Quando NÃO usar

Para lógica de detecção de projeto — use a skill `detector`.
Para lógica de leitura de config/registry — use contexto geral.

## Contexto essencial

- Cada adapter recebe `ToolConfig`, `ProjectDetails` e `Registry`
- Todo adapter implementa `generate(dryRun?: boolean): Promise<AdapterResult>`
- `AdapterResult` retorna `{ files: string[] }` — lista de arquivos gerados
- Adapters nunca escrevem em `dry-run` — apenas retornam os caminhos
- Placeholders `{{commands.x}}` são resolvidos via `resolvePlaceholders()` do `resolver.ts`
- Conteúdo dos commands vem de `src/commands/shared/*.md` via `gray-matter`

## Regras

- Nunca escrever fora de `ROOT` (cwd do usuário) e `HARNESS_ROOT`
- Sempre usar `mkdir({ recursive: true })` antes de escrever
- Sempre checar `dryRun` antes de qualquer `writeFile`
- Nunca modificar arquivos protegidos (ver `HARNESS_ROOT/core/rules.md`)
- O método `generate()` deve ser idempotente — rodar duas vezes produz o mesmo resultado

## Padrões

```typescript
// Estrutura padrão de um adapter
export class MeuAdapter {
  constructor(
    private toolConfig: ToolConfig,
    private project: ProjectDetails,
    private registry: Registry,
  ) {}

  async generate(dryRun = false): Promise<AdapterResult> {
    const files: string[] = []
    // ... lógica de geração
    if (!dryRun) await writeFile(path, content, 'utf-8')
    files.push(path)
    return { files }
  }
}
```

## Checklist de execução

- [ ] Implementa `generate(dryRun?)` corretamente?
- [ ] Respeita `dryRun` em todos os `writeFile`?
- [ ] Usa `resolvePlaceholders()` para conteúdo com `{{placeholders}}`?
- [ ] Registrado em `src/sync.ts` no map `ADAPTERS`?
- [ ] Registrado em `harness.config.json` com suas capacidades?

## Referências

- `src/types.ts` — interfaces `ToolConfig`, `ProjectDetails`, `AdapterResult`
- `src/resolver.ts` — `resolvePlaceholders()`
- `src/sync.ts` — onde adapters são registrados
