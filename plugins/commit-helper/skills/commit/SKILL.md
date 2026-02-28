# /commit - Commit Helper

Generate conventional commit messages based on staged changes.

## Usage

```
/commit
```

## Instructions

When the user invokes `/commit`, analyze the currently staged git changes and generate a well-structured conventional commit message.

### Steps

1. Run `git diff --cached` to see staged changes. If nothing is staged, run `git diff` and tell the user to stage changes first.
2. Analyze the diff to understand what changed and why.
3. Generate a commit message following the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Message Format

```
<type>(<scope>): <short summary>

<body>

Co-Authored-By: <user's configured co-author if any>
```

**Types:**
- `feat` - A new feature
- `fix` - A bug fix
- `docs` - Documentation changes
- `style` - Formatting, missing semicolons, etc. (no code change)
- `refactor` - Code restructuring without changing behavior
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `chore` - Build process, dependencies, tooling

**Rules:**
- The summary line must be under 72 characters
- Use imperative mood ("add feature" not "added feature")
- The body should explain *what* and *why*, not *how*
- If changes span multiple concerns, suggest splitting into separate commits

### Behavior

- Present the generated message and ask the user to confirm or edit before committing.
- If the diff is very large (>500 lines), suggest reviewing changes and possibly splitting the commit.
- Check the repo's recent commit history (`git log --oneline -10`) to match the project's existing style.
