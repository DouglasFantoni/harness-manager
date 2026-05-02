# Skill: Detector

## Meta

```yaml
domain: backend
weight: ~500
exposes_command: []
required_by: ["/review"]
load_with: []
conflicts_with: []
```

## Quando usar

Ao editar `src/detector/index.ts` — lógica de detecção automática de projeto
que roda durante o `harness init`.

## Quando NÃO usar

Para lógica de geração de adapters ou sync — use a skill `adapter`.

## Contexto essencial

- O detector inspeciona o projeto do usuário via filesystem — nunca executa código do projeto
- Retorna `{ details: ProjectDetails, reviewHints: string[] }`
- Toda detecção é best-effort — sempre com fallback seguro (string vazia, array vazio)
- `detectPackageManager()` usa `existsSync` síncrono — único lugar aceitável no codebase
- O helper `pick(condition, value)` resolve o problema de tipo `false | string` em arrays

## Regras

- Nunca lançar exceção se um arquivo não existe — usar `catch` com fallback
- Nunca executar scripts do projeto (`npm install`, `tsc`, etc.)
- Nunca fazer requisições de rede
- Sempre retornar `reviewHints` com o que o usuário deve verificar manualmente
- `branch_pattern` e `critical_files` nunca são detectados automaticamente — sempre vazios

## Padrões

```typescript
// Padrão para detecção segura de arquivo
async function fileExists(path: string): Promise<boolean> {
  try { await access(resolve(ROOT, path)); return true }
  catch { return false }
}

// Padrão para leitura segura de JSON
async function readJsonSafe(path: string): Promise<Record<string, unknown> | null> {
  try { return JSON.parse(await readFile(resolve(ROOT, path), 'utf-8')) }
  catch { return null }
}

// Padrão para arrays de detecção tipados
const techs = [
  pick(has('@nestjs/core'), 'nestjs'),
  pick(has('typescript'), 'typescript'),
].filter((x): x is string => x !== undefined)
```

## Checklist de execução

- [ ] Novos detectores têm fallback seguro?
- [ ] `reviewHints` inclui orientação para o que não foi detectado?
- [ ] `typecheck` passa após alteração?

## Referências

- `src/types.ts` — interface `ProjectDetails`
- `src/commands/init.ts` — consome `detectProject()`
