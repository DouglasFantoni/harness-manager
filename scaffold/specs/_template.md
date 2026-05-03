# Feature: {Nome da Feature}

> Copie para `specs/{feature}/spec.md` e preencha todos os campos.
> Depois adicione uma linha em `specs/_index.md`.

## Metadados

```yaml
id: feat-000                    # identificador único (feat-001, feat-002, ...)
status: draft                   # draft | ready | in-progress | done | deprecated
domain: ""                      # skill de domínio relacionada (ex: invite-confirmation)
owner: ""                       # quem é responsável pela spec (nome ou time)
created: YYYY-MM-DD
updated: YYYY-MM-DD
```

## Contexto

<!-- Por que esta feature existe? Qual problema resolve?
     2-4 frases. Evite detalhe técnico aqui — foco no problema de negócio. -->

## User Stories

<!-- Repita o bloco abaixo para cada story.
     Cada story deve ser independente e testável isoladamente. -->

### US-01 — {Título curto}

**Como** {tipo de usuário}
**Quero** {ação ou capacidade}
**Para** {benefício ou objetivo}

**Critérios de aceite:**
- [ ] {critério observável e verificável}
- [ ] {critério observável e verificável}
- [ ] {critério observável e verificável}

**Fora de escopo:**
- {o que explicitamente não faz parte desta story}

---

### US-02 — {Título curto}

**Como** {tipo de usuário}
**Quero** {ação ou capacidade}
**Para** {benefício ou objetivo}

**Critérios de aceite:**
- [ ] {critério}

---

## Regras de negócio

<!-- Restrições e invariantes que se aplicam à feature como um todo.
     Diferente dos critérios de aceite — são regras que cruzam stories. -->

- {regra}

## Perguntas em aberto

<!-- Dúvidas que precisam ser resolvidas antes de marcar como `ready`.
     Remova esta seção quando não houver mais perguntas. -->

- [ ] {pergunta}

## Referências

<!-- Links para documentos, ADRs, discussões ou issues relacionados. -->

- `memory/decisions.md#{ancora}` (se houver decisão arquitetural relacionada)
