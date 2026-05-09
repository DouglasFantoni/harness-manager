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
