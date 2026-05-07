# Performance

Dicas para reduzir consumo de tokens e melhorar a velocidade das ferramentas de IA.

---

## Claude Code

### Usar ripgrep do sistema ao invés do bundled

O Claude Code vem com ripgrep embutido, mas rodado através de um wrapper Node.js.
Usando o ripgrep instalado no sistema diretamente, as buscas ficam 5-10x mais rápidas
em codebases grandes — e o output é mais limpo, gerando menos ruído de tokens.

**1. Instale o ripgrep no sistema:**

```bash
# Ubuntu / Debian / WSL
sudo apt install ripgrep

# macOS
brew install ripgrep

# Fedora
sudo dnf install ripgrep

# Arch
sudo pacman -S ripgrep

# Windows (sem WSL)
winget install BurntSushi.ripgrep.MSVC
```

**2. Configure o Claude Code para usar o sistema:**

```bash
# Adicione ao ~/.zshrc ou ~/.bashrc
echo 'export USE_BUILTIN_RIPGREP=0' >> ~/.zshrc
source ~/.zshrc
```

**3. Verifique:**

```bash
echo $USE_BUILTIN_RIPGREP  # deve retornar 0
```

---

### WSL: manter o projeto no filesystem Linux

Se você usa WSL e o projeto está em `/mnt/c/` (filesystem do Windows), as buscas
são significativamente mais lentas por causa da camada de tradução de I/O.

```bash
# Mova o projeto para o filesystem Linux
mv /mnt/c/seu-projeto ~/projetos/seu-projeto
```

Projetos em `/home/` no WSL têm performance equivalente a um sistema Linux nativo.

---

### `.ripgrepignore` para projetos com arquivos grandes

Se o projeto tem arquivos gerados grandes ou minificados que estão no git mas
não devem ser lidos pela IA, crie um `.ripgrepignore` na raiz:

```
# .ripgrepignore
*.min.js
*.min.css
*.bundle.js
generated/
```

O Claude Code (e o ripgrep) vão ignorar esses arquivos em todas as buscas,
reduzindo ruído no contexto sem precisar alterar o `.gitignore`.

---

## Cursor

### Usar ripgrep do sistema

O Cursor também usa ripgrep internamente. Para garantir que o sistema está sendo usado:

```bash
# Verifique se rg está instalado
which rg

# Se não estiver, instale (ver comandos acima)
```

O Cursor detecta automaticamente o `rg` no PATH — não precisa de variável de ambiente.

---

### Context window: skills com globs

Skills do harness com `globs` declarados são carregadas automaticamente
pelo Cursor apenas quando o arquivo aberto corresponde ao padrão.
Isso evita ocupar contexto com skills irrelevantes para a task atual.

Para declarar globs em uma skill, edite o `## Meta` do `SKILL.md`:

```yaml
globs: ["**/*.service.ts", "apps/api/**/*.ts"]
```

Depois rode `harness sync` para gerar os `.mdc` correspondentes.

---

## Todas as ferramentas

### Prefira `rg` ao invés de `grep` em comandos bash

Quando a IA escrever comandos de busca, `rg` é sempre melhor que `grep`:

```bash
# ❌ grep — lento, sem respeitar .gitignore
grep -r "minhaFuncao" .

# ✅ rg — rápido, ignora node_modules/dist/.next automaticamente
rg "minhaFuncao"

# Busca por tipo de arquivo (menos tokens no resultado)
rg "minhaFuncao" --type ts

# Só nomes de arquivos, sem conteúdo (mínimo de tokens)
rg -l "minhaFuncao"

# String literal sem regex (mais rápido quando não precisa de padrão)
rg -F "minhaFuncao()"
```

Esta regra já está em `.harness/core/rules.md` — a IA vai seguir automaticamente.

---

### Condensar memory quando crescer demais

Com o tempo, `memory/mistakes.md` e `memory/patterns.md` acumulam entradas.
Quando ficarem grandes, use o prompt de condensação:

```bash
harness prompt memory-summarize
```

Cole o output na sua IA para gerar versões condensadas dos arquivos de memory.

---

### SKILL.min.md — skills comprimidas automaticamente

O `harness sync` gera automaticamente uma versão comprimida de cada skill
(`SKILL.min.md`) removendo seções que a IA não precisa em runtime
(Meta, Checklist, Referências). Redução típica de 30-50% em tokens.

Os arquivos `.min.md` são gerados automaticamente — você não precisa fazer nada.
Verifique a redução no output do sync:

```
⚡ 3 skill(s) minificada(s) — 3161 → 2586 tokens (-18%)
```
