# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A cross-platform plugin marketplace for Claude Code and GitHub Copilot CLI. Plugins are collections of skills, agents, and hooks defined entirely in markdown and JSON — no build step, no runtime code.

## Architecture

**Convention-driven discovery**: Components are found by file placement, not configuration.

```
plugins/<plugin-name>/
├── .claude-plugin/plugin.json        # Minimal metadata (name, description, author)
├── skills/<skill-name>/SKILL.md      # Skill definitions (YAML frontmatter + markdown)
├── agents/<name>.agent.md            # Agent definitions
└── hooks.json                        # Event-based hooks
```

**Two marketplace manifests must stay identical**:
- `.claude-plugin/marketplace.json` — Claude Code reads this
- `.github/plugin/marketplace.json` — Copilot CLI reads this

When adding or modifying a plugin entry, always update both files.

## Adding a New Plugin

1. Create `plugins/<name>/` with `.claude-plugin/plugin.json` and components
2. Add an entry to both `marketplace.json` files with name, description, version, source, category, and tags
3. Plugin names: lowercase, hyphenated (e.g., `code-review`, `commit-helper`)

**Marketplace categories**: code-quality, git, security, testing, docs, workflow, development

## Skill Format (YAML Frontmatter)

The current standard for skills uses YAML frontmatter:

```yaml
---
name: skill-name          # Must match folder name, lowercase/hyphens, 1-64 chars
description: 'What it does. Use when <triggers and keywords>.'  # 1-1024 chars
---
```

The `description` is the primary mechanism for automatic skill discovery — it must include what the skill does AND when to use it with relevant keywords.

## Hooks Format

```json
{
  "hooks": [{
    "event": "before_command | after_command | after_edit",
    "pattern": "regex pattern",
    "action": "suggest",
    "message": "Message shown to user"
  }]
}
```

## Validation

There is no automated CI. Validate manually:
- Plugin name is lowercase with hyphens, matches across plugin.json and marketplace entries
- Skill `name` field matches its folder name
- Skill `description` is 10-1024 chars and explains what AND when
- Both marketplace.json files are identical
- One plugin per PR
