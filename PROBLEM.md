# The Problem

## Every AI session starts from zero

When you open a new session with an AI tool — Cursor, Claude Code, Copilot — it knows nothing about your project. You explain the same context over and over. It makes the same mistakes. It uses the wrong names for domain entities. It ignores architectural decisions you've already made and documented elsewhere.

This isn't a bug. It's how these tools work. But it compounds over time in ways that are easy to underestimate.

---

## What this actually costs

**Repeated mistakes.** The AI suggests using a flat INSS tax rate instead of the progressive table — the same mistake that took you two hours to debug three months ago. There's no institutional memory, so it happens again.

**Inconsistent vocabulary.** One session calls it `Customer`, the next `Client`, the next `User`. The codebase slowly accumulates naming inconsistencies that make it harder for humans and AIs alike to reason about the domain.

**Ignored decisions.** Your team decided to never use `any` to paper over type errors, always run `typecheck` before considering a task done, and never modify migrations without checking the ADR log. The AI doesn't know any of this. Every session starts with a blank slate.

**Context tax.** You spend the first part of every session re-explaining what the project is, what stack it uses, what patterns are established, what not to do. This is time and tokens that should go toward actual work.

**Knowledge that lives only in heads.** Senior devs accumulate deep understanding of the codebase — the traps, the patterns, the reasoning behind decisions. This knowledge doesn't transfer automatically. A new dev, or a new AI session, starts from scratch.

---

## The deeper issue

The problem isn't just that AI tools lack memory. It's that **projects lack a structured way to accumulate and communicate their own context** — to humans and to AIs.

Teams write READMEs, but they go stale. They write Confluence pages, but nobody reads them before asking the AI. They have tribal knowledge, but it lives in Slack threads and people's heads.

What's missing is a living, structured, project-specific knowledge layer that:

- Is maintained alongside the code, not separately
- Grows more useful over time as the project evolves
- Is formatted in a way that AI tools can actually use
- Distinguishes between what is always true (rules), what was learned (mistakes, patterns), and what was decided (architecture)
- Is owned by the team, not by any single AI provider

---

## What good looks like

A developer joins a project six months in. They open their AI tool. Before writing a single line of code, the AI already knows:

- The domain vocabulary — what a `Customer` is vs a `User`, what `holerite` means in this context
- The architectural decisions — why the tax calculation lives in a shared package, why snapshots are used for fiscal data
- The known traps — the INSS flat-rate mistake, the missing `taxSnapshot` anti-pattern, the migration process
- The established patterns — how services are structured, how errors are handled, what a good test looks like here
- The project conventions — branch naming, commit format, which commands to run before considering something done

The AI doesn't just write code. It writes *this project's* code.

---

## The test

This file exists to be honest about what we're trying to solve. Every feature decision in the AI Harness should be evaluated against these questions:

1. Does this reduce the context tax per session?
2. Does this prevent repeated mistakes?
3. Does this make project knowledge accumulate rather than evaporate?
4. Does this work across AI tools, not just one?
5. Does this stay useful as the project grows and changes?

If a feature doesn't move at least one of these needles, it probably doesn't belong here.
