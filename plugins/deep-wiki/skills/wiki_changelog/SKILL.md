---
name: wiki_changelog
description: Analyzes git commit history and generates structured changelogs categorized by change type. Use when the user asks about recent changes, wants a changelog, or needs to understand what changed in the repository.
---

# Wiki Changelog

Generate structured changelogs from git history.

## When to Activate

- User asks "what changed recently", "generate a changelog", "summarize commits"
- User wants to understand recent development activity

## Procedure

1. Examine git log (commits, dates, authors, messages)
2. Group by time period: daily (last 7 days), weekly (older)
3. Classify each commit: Features (🆕), Fixes (🐛), Refactoring (🔄), Docs (📝), Config (🔧), Dependencies (📦), Breaking (⚠️)
4. Generate concise user-facing descriptions using project terminology

## Output

Markdown changelog with time-grouped sections, each commit classified by category emoji. Example:

```markdown
## Week of Jan 6, 2025
### 🆕 Features
- Added OAuth2 support for third-party integrations
### 🐛 Fixes
- Fixed race condition in session cleanup
```

## Constraints

- Focus on user-facing changes
- Merge related commits into coherent descriptions
- Use project terminology from README
- Highlight breaking changes prominently with migration notes

## Error Handling

- If git log is empty, report "No commits found" and suggest checking the branch
- If commit messages are uninformative (e.g., "fix", "wip"), group them under "Uncategorized"
