# Skill Registry

Skills oficiais do AI Harness Framework, mantidas e otimizadas ao longo do tempo.

## Como instalar uma skill

```bash
harness skill-add nestjs
harness skill-add payroll
harness skill-add nextjs
```

## Como manter atualizado

```bash
harness skill-sync              # atualiza todas as skills com source
harness skill-sync nestjs       # atualiza uma skill específica
harness skill-sync --check      # mostra quais têm update disponível
harness skill-sync --dry-run    # mostra diff sem aplicar
```

## Customizando uma skill

Adicione suas customizações na seção dedicada do `SKILL.md`:

```markdown
## Customizações do projeto

<!-- HARNESS:CUSTOM:START -->
Suas regras e adaptações aqui.
Esta seção nunca é sobrescrita pelo sync.
<!-- HARNESS:CUSTOM:END -->
```

## Desativando sync para uma skill

Defina `sync: false` no Meta da skill:

```yaml
sync: false
```

## Skills disponíveis

| Skill | Descrição | Versão |
|-------|-----------|--------|
| `nestjs` | NestJS — services, controllers, módulos, injeção de dependência | 1.0.0 |
| `nextjs` | Next.js — App Router, Server Components, RSC patterns | 1.0.0 |
| `payroll` | Folha de pagamento — INSS, IRRF, FGTS, taxSnapshot | 1.0.0 |

---

## Rule Packs

Conjuntos de regras organizados por categoria.

```bash
harness rule-add typescript
harness rule-add nestjs
harness rule-add security
harness rule-add git
```

```bash
harness rule-sync              # atualiza todos
harness rule-sync typescript   # atualiza um específico
harness rule-sync --check      # verifica versões
```

| Pack | Descrição | Versão |
|------|-----------|--------|
| `typescript` | Tipos, imports, nullability, async, validação | 1.0.0 |
| `nestjs` | Estrutura, providers, DTOs, config, exceptions | 1.0.0 |
| `security` | Dados sensíveis, auth, inputs, APIs, dependências | 1.0.0 |
| `git` | Commits, branches, PRs, o que nunca fazer | 1.0.0 |
