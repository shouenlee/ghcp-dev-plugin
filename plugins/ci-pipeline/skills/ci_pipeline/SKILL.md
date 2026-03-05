---
name: ci_pipeline
description: 'Generates GitHub Actions CI/CD workflows, diagnoses failing runs from logs, and adds pipeline steps. Use when asked to "set up ci", "create pipeline", "fix ci", "ci failing", "github actions", "add ci step", "diagnose build", or "workflow yaml".'
---

# CI Pipeline

Generate, diagnose, and extend GitHub Actions CI/CD workflows directly from the command line.

## When to Use

- You need to set up CI/CD for a new project
- A CI run is failing and you want to quickly identify the root cause
- You want to add a new step (linting, security scanning, deployment, etc.) to an existing workflow

## Prerequisites

- `gh` CLI installed and authenticated (`gh auth status`)
- Git repository with a GitHub remote configured

## Workflow

### `/ci init` — Generate a GitHub Actions workflow

1. Detect the project type from files present in the repository:
   ```bash
   # Checks for these files to determine language/framework
   ls pyproject.toml setup.py requirements.txt  # Python
   ls package.json                                # Node.js
   ls go.mod                                      # Go
   ls Cargo.toml                                  # Rust
   ls pom.xml build.gradle                        # Java
   ```

2. Detect the test framework based on project configuration:
   ```bash
   # Python: pytest, unittest
   # Node.js: jest, mocha, vitest
   # Go: go test
   # Rust: cargo test
   ```

3. Detect the package manager:
   ```bash
   # Python: uv, pip, poetry, pipenv
   # Node.js: npm, yarn, pnpm
   ```

4. Generate `.github/workflows/ci.yml` with the following stages:
   ```yaml
   # checkout → language setup → dependency install → lint → test → build (optional)
   ```

5. Include caching for dependencies to speed up CI runs:
   ```yaml
   - uses: actions/cache@v4
     with:
       path: ~/.cache/pip   # or node_modules, ~/go/pkg/mod, etc.
       key: ${{ runner.os }}-deps-${{ hashFiles('**/lockfile') }}
   ```

6. Set up matrix testing if multiple language versions are relevant:
   ```yaml
   strategy:
     matrix:
       python-version: ["3.10", "3.11", "3.12"]
   ```

7. Present the generated workflow and offer to write it to `.github/workflows/ci.yml`.

### `/ci diagnose` — Diagnose a failing CI run

1. List recent workflow runs:
   ```bash
   gh run list --limit 5
   ```

2. If the user specifies a run ID, use it; otherwise pick the most recent failed run.

3. Fetch the failed logs:
   ```bash
   gh run view <run-id> --log-failed
   ```

4. Analyze the error output to identify the root cause (dependency failures, test errors, syntax issues, etc.).

5. Search the codebase for files related to the failure:
   ```bash
   # e.g., find the failing test file, the misconfigured dependency, etc.
   ```

6. Present the diagnosis with:
   - **Error summary** — what failed
   - **Root cause** — why it failed
   - **Suggested fix** — code or configuration change to resolve it

7. Offer to apply the fix directly.

### `/ci add-step` — Add a step to an existing workflow

1. Read existing workflow files:
   ```bash
   ls .github/workflows/*.yml
   ```

2. Ask what step to add (or accept it from user input), e.g., "add a security scan step" or "add deployment to staging".

3. Generate the step YAML appropriate for the request.

4. Insert the step at the correct position in the workflow (e.g., after tests, before deploy).

5. Validate the resulting YAML structure to ensure correctness.

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| `gh: command not found` | gh CLI is not installed | Install from https://cli.github.com/ |
| `gh: not logged in` | gh CLI is not authenticated | Run `gh auth login` |
| No workflows found | No `.github/workflows/` directory exists | Run `/ci init` to generate a workflow |
| YAML syntax error after edit | Invalid indentation or structure | Check indentation (2 spaces) and re-validate with a YAML linter |
| Run logs are empty | Run is still in progress or was cancelled | Wait for the run to complete or check a different run |
