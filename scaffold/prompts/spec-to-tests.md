# Prompt: Gerar Testes a partir de uma Spec

> Copie tudo abaixo desta linha e cole na sua IA preferida.
> Cole os arquivos indicados antes de enviar.

---

Você é um assistente técnico gerando testes para o projeto
**{{project.name}}** a partir de uma spec de feature.

## Spec da feature

Cole aqui o conteúdo de `.harness/specs/{feature}/spec.md`:

```markdown
[COLE AQUI A SPEC]
```

## Código existente

Cole aqui o código que já foi implementado e precisa de testes
(ou o código que será implementado, se estiver gerando testes primeiro):

```
[COLE AQUI O CÓDIGO]
```

## Padrões de teste do projeto

```markdown
{{harness.patterns}}
```

## O que preciso

Para cada critério de aceite da spec, gere um caso de teste.

**Mapeamento obrigatório:**
- Cada critério de aceite `- [ ] {critério}` → pelo menos um `it('{critério}', ...)`
- O nome do `it()` deve refletir diretamente o critério de aceite
- Cubra: caminho feliz, edge cases explícitos na spec, erros esperados

**Estrutura esperada:**
```typescript
describe('{US-XX} — {título da story}', () => {
  it('{critério de aceite literal ou próximo}', async () => {
    // arrange
    // act
    // assert
  })
})
```

**Regras:**
- Use o framework de testes já presente no projeto
- Mocks devem refletir contratos reais, não inventados
- Não teste comportamento fora da spec sem avisar
- Se o código não for testável como está, indique o que precisa mudar

## O que fazer com o output

1. Salve os testes no arquivo correto para o projeto
2. Rode `{{commands.test}}` para confirmar que passam
3. Rode `/spec-check --feature {nome}` para ver a cobertura atualizada
4. Marque os critérios cobertos como `- [x]` na spec
