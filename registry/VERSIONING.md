# Registry versioning policy

Official skills and rule packs use [Semantic Versioning](https://semver.org/) in the `version` field of each package meta block.

## Version bumps

| Change | Bump | Example |
|--------|------|---------|
| Breaking rule/skill behavior, removed sections, renamed globs that affect loading | **MAJOR** | `1.2.0` → `2.0.0` |
| New rules, examples, or non-breaking globs | **MINOR** | `1.2.0` → `1.3.0` |
| Typos, clarifications, token-neutral wording | **PATCH** | `1.2.0` → `1.2.1` |

## Breaking changes

A **breaking change** is anything that can make existing projects behave differently after `harness skill-sync` / `harness rule-sync` without editing local `HARNESS:CUSTOM` blocks:

- Removing or renaming rules that agents relied on
- Tightening globs so skills stop loading for common paths
- Changing required workflow steps in commands/hooks referenced by the pack

Every MAJOR release **must** include a `CHANGELOG.md` next to the package (`SKILL.md` or `{pack}.md`).

## Consumer workflow

1. `harness skill-sync --check` / `harness rule-sync --check` — shows `⚠️ MAJOR` when remote major is ahead.
2. Read `CHANGELOG.md` in the registry (URL derived from `source` in local meta).
3. Run sync; review diff; update `HARNESS:CUSTOM` if needed.
4. Run `harness sync` to refresh adapters.

## Private / scoped registries

Configure scopes in `.harness/harness.config.json`:

```json
"registry": {
  "scopes": {
    "myorg": {
      "skills_base_url": "https://raw.githubusercontent.com/myorg/harness-registry/main/skills",
      "rules_base_url": "https://raw.githubusercontent.com/myorg/harness-registry/main/rules",
      "token_env": "MYORG_GITHUB_TOKEN"
    }
  }
}
```

Install: `harness skill-add @myorg/payroll`

For private GitHub repos, set `GITHUB_TOKEN` or the scope-specific `token_env` before add/sync.
