# Specs Registry

> Registro de todas as features especificadas neste projeto.
> Adicione uma linha para cada spec criada em `specs/{feature}/spec.md`.

| Feature | Status | Stories | Cobertura |
|---------|--------|---------|-----------|
| _(nenhuma spec criada ainda)_ | — | — | — |

## Status possíveis

| Status | Significado |
|--------|-------------|
| `draft` | Spec em elaboração, não implementar ainda |
| `ready` | Spec aprovada, pronta para implementação |
| `in-progress` | Implementação em andamento |
| `done` | Todos os critérios de aceite cobertos por testes |
| `deprecated` | Feature descontinuada |

## Como criar uma nova spec

1. Copie `specs/_template.md` para `specs/{feature}/spec.md`
2. Preencha os campos do template
3. Adicione uma linha neste arquivo
4. Use o prompt `harness prompt spec-implement` para implementar
5. Use o comando `/spec-check` para validar cobertura
