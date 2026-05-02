# Hook: On-Error

> weight: ~250 | bloqueia: sim
> Disparado quando: comando falha, tipo errado, teste quebra, build falha, output inesperado.

## 1. Classifique o erro antes de agir

| Tipo | Ação |
|------|------|
| Sintático (type error, lint) | Corrija diretamente, rode `typecheck` para confirmar |
| Lógico (teste falha, output errado) | Leia `memory/mistakes.md` antes de tentar fix |
| Ambiental (build falha, dep missing) | Não tente resolver sem entender o ambiente |
| Desconhecido | Declare explicitamente — não chute |

## 2. Verifique a memória

- [ ] Este erro já está em `memory/mistakes.md`?
- [ ] **Sim** → siga a solução documentada, não reinvente
- [ ] **Não** → documente após resolver (via `post-task`)

## 3. Regras de retry

- Máximo **2 tentativas** com a mesma abordagem
- Na **3ª tentativa** → mude a estratégia ou escale para o usuário
- Nunca silencie um erro para "fazer funcionar"

## 4. O que nunca fazer em erro

- ❌ Remover o teste que falhou
- ❌ Usar `any` para resolver type error
- ❌ Ignorar erro de build e continuar
- ❌ Aplicar fix sem entender a causa raiz
- ❌ Comentar código quebrado como solução temporária
