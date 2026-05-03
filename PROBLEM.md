# O Problema

## Toda sessão de IA começa do zero

Quando você abre uma nova sessão com uma ferramenta de IA — Cursor, Claude Code, Copilot — ela não sabe nada sobre o seu projeto. Você explica o mesmo contexto repetidamente. Ela comete os mesmos erros. Usa nomes errados para entidades do domínio. Ignora decisões arquiteturais que você já tomou e documentou em outro lugar.

Isso não é um bug. É como essas ferramentas funcionam. Mas o custo se acumula ao longo do tempo de formas fáceis de subestimar.

---

## O que isso custa na prática

**Erros repetidos.** A IA sugere usar alíquota flat de INSS ao invés da tabela progressiva — o mesmo erro que levou duas horas para depurar três meses atrás. Não há memória institucional, então acontece de novo.

**Vocabulário inconsistente.** Uma sessão chama de `Customer`, a próxima de `Client`, a próxima de `User`. O codebase acumula lentamente inconsistências de nomenclatura que dificultam o raciocínio tanto para humanos quanto para IAs.

**Decisões ignoradas.** O time decidiu nunca usar `any` para tapar erros de tipo, sempre rodar `typecheck` antes de considerar uma task concluída, e nunca modificar migrations sem verificar o log de ADRs. A IA não sabe nada disso. Cada sessão começa do zero.

**Taxa de contexto.** Você gasta o início de cada sessão re-explicando o que é o projeto, qual stack usa, quais padrões estão estabelecidos, o que não fazer. Isso é tempo e tokens que deveriam ir para o trabalho em si.

**Conhecimento que vive só em cabeças.** Devs seniores acumulam entendimento profundo do codebase — as armadilhas, os padrões, o raciocínio por trás das decisões. Esse conhecimento não se transfere automaticamente. Um dev novo, ou uma nova sessão de IA, começa do zero.

---

## O problema mais profundo

O problema não é apenas que ferramentas de IA não têm memória. É que **projetos não têm uma forma estruturada de acumular e comunicar seu próprio contexto** — para humanos e para IAs.

Times escrevem READMEs, mas ficam desatualizados. Escrevem páginas no Confluence, mas ninguém lê antes de perguntar para a IA. Têm conhecimento tribal, mas ele vive em threads do Slack e nas cabeças das pessoas.

O que falta é uma camada de conhecimento viva, estruturada e específica do projeto que:

- Seja mantida junto com o código, não separadamente
- Fique mais útil ao longo do tempo conforme o projeto evolui
- Esteja formatada de um jeito que ferramentas de IA consigam usar de verdade
- Diferencie o que é sempre verdade (regras), o que foi aprendido (erros, padrões) e o que foi decidido (arquitetura)
- Pertença ao time, não a nenhum provedor de IA específico

---

## Como deveria ser

Um desenvolvedor entra num projeto seis meses depois do início. Ele abre sua ferramenta de IA. Antes de escrever uma linha de código, a IA já sabe:

- O vocabulário do domínio — o que `Cliente` é vs `Usuário`, o que `holerite` significa neste contexto
- As decisões arquiteturais — por que o cálculo de impostos fica num pacote compartilhado, por que snapshots são usados para dados fiscais
- As armadilhas conhecidas — o bug da alíquota flat de INSS, o anti-padrão de `taxSnapshot` ausente, o processo de migrations
- Os padrões estabelecidos — como services são estruturados, como erros são tratados, como um bom teste se parece aqui
- As convenções do projeto — nomenclatura de branches, formato de commit, quais comandos rodar antes de considerar algo pronto

A IA não só escreve código. Ela escreve *o código deste projeto*.

---

## O teste

Este arquivo existe para ser honesto sobre o que estamos tentando resolver. Toda decisão de feature do AI Harness deve ser avaliada contra estas perguntas:

1. Isso reduz a taxa de contexto por sessão?
2. Isso previne erros repetidos?
3. Isso faz o conhecimento do projeto acumular ao invés de evaporar?
4. Isso funciona em múltiplas ferramentas de IA, não só uma?
5. Isso continua útil conforme o projeto cresce e muda?

Se uma feature não move pelo menos um desses ponteiros, ela provavelmente não pertence aqui.
