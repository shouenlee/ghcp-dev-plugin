---
name: python-lint-fix
description: 'Runs ruff, mypy, and bandit on changed Python files — explains violations and auto-fixes with ruff check --fix. Use when asked to "lint", "fix lint", "check types", "type check", "run mypy", "run ruff", "python quality", or "lint python files".'
---

# Python Lint Fix

Analyze Python files for lint violations, type errors, and security issues using ruff, mypy, and bandit. Automatically fix what can be fixed and explain remaining issues.

## When to Use

- You want to check Python files for code quality issues before committing
- You need to find and fix lint violations, type errors, or security issues
- You want to auto-fix formatting and import sorting with ruff
- You are reviewing Python code and want a quick quality check

## Prerequisites

The following tools must be installed. If missing, install them with:

```bash
uv pip install ruff mypy bandit
```

- **ruff** -- fast Python linter and formatter
- **mypy** -- static type checker for Python
- **bandit** -- security-focused static analysis tool

## Workflow

1. **Identify target files** -- determine which Python files to check. Use changed files from git or user-specified paths:

   ```bash
   git diff --name-only HEAD -- '*.py'
   ```

   If the user specifies files or directories, use those instead.

2. **Run ruff check** on the target files and capture the output:

   ```bash
   ruff check <files>
   ```

3. **Run mypy** on the target files and capture the output:

   ```bash
   mypy <files>
   ```

4. **Run bandit** on the target files and capture the output:

   ```bash
   bandit -r <files>
   ```

5. **Present findings** grouped by tool. For each issue, include:
   - File path and line number (`file:line`)
   - Rule ID (e.g., `E501`, `F841`, `B101`)
   - Severity (error, warning, info)
   - Explanation of what the rule catches and why it matters

6. **Offer to auto-fix** issues that ruff can handle automatically:

   ```bash
   ruff check --fix <files>
   ruff format <files>
   ```

7. **Re-run checks** to confirm fixes were applied and report any remaining issues:

   ```bash
   ruff check <files>
   mypy <files>
   bandit -r <files>
   ```

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `ruff: command not found` | ruff is not installed | Run `uv pip install ruff` or `pip install ruff` |
| `mypy: command not found` | mypy is not installed | Run `uv pip install mypy` or `pip install mypy` |
| `bandit: command not found` | bandit is not installed | Run `uv pip install bandit` or `pip install bandit` |
| mypy reports `Cannot find implementation or library stub` | Missing type stubs for third-party packages | Run `mypy --install-types` or add stubs with `uv pip install types-<package>` |
| mypy reports `Skipping analyzing` | Module is not in the mypy search path | Add the source directory to `mypy.ini` or `pyproject.toml` under `[tool.mypy]` with `mypy_path` |
| ruff ignores some files | Files are excluded in `pyproject.toml` or `ruff.toml` | Check `[tool.ruff]` exclude patterns in your config file |
| Too many issues reported | No config file limiting rule set | Create a `ruff.toml` or `[tool.ruff]` section in `pyproject.toml` to select specific rule sets |
| bandit reports false positives | Some rules are too strict for your codebase | Use `# nosec` inline comments or configure exclusions in `.bandit` or `pyproject.toml` |
| `ruff check --fix` did not fix all issues | Some violations require manual intervention | Review the remaining issues and fix them by hand; ruff marks auto-fixable rules in its output |
