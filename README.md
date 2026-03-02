# ghcp-dev-plugins

A cross-platform plugin marketplace for **Claude Code** and **GitHub Copilot CLI**.

Both tools share compatible plugin systems, so every plugin in this marketplace works with either tool out of the box.

## Available Plugins

### Custom Plugins

| Plugin | Category | Components | Description |
|--------|----------|------------|-------------|
| **code-review** | code-quality | skill, agent | Analyzes code for bugs, security issues, performance problems, and readability |
| **security-check** | security | skill, hook | Scans for hardcoded secrets, injection risks, and common vulnerabilities |
| **make-skill-template** | development | skill | Scaffolds new Agent Skills with proper frontmatter and directory structure |
| **commit-changes** | git | skill, hook | Reviews diffs and creates well-structured commits, splitting by logical concern |
| **review-pr** | code-quality | skill, agent, hook | Reviews GitHub PRs — analyzes quality, verifies tests, posts inline comments |
| **python-lint-fix** | code-quality | skill, hook, reference | Runs ruff + mypy + bandit on Python files, explains violations, auto-fixes |
| **test-gen** | testing | 2 skills, hook | Generates pytest suites from source files and tracks coverage gaps |
| **pr-description** | git | skill, hook | Generates structured PR descriptions from branch diffs |
| **ci-pipeline** | workflow | skill, agent, hook | Generates GitHub Actions workflows and diagnoses CI failures |
| **release-notes** | git | skill, hook | Generates changelogs, bumps semver, publishes GitHub releases |
| **scaffold-app** | development | skill, 4 templates | Generates Django/FastAPI boilerplate — endpoints, models, tasks, test stubs |
| **docker-compose** | development | skill, hook | Generates Dockerfiles and compose configs, adds services, checks anti-patterns |
| **design-doc** | docs | skill, agent, hook | Generates RFCs and ADRs with consistent numbering and format |
| **task-breakdown** | workflow | skill, hook | Decomposes features/issues into ordered subtasks with acceptance criteria |
| **dep-manager** | development | skill, hook | Manages Python deps — add, remove, audit vulnerabilities, detect unused |
| **incident-response** | workflow | 2 skills, agent | Triages incidents, correlates with deploys, generates postmortems and runbooks |
| **api-docs** | docs | skill, hook | Generates API docs from FastAPI/DRF code and detects documentation drift |

### Community Plugins

These are installable from the same marketplace via GitHub source references.

| Plugin | Source | Description |
|--------|--------|-------------|
| **ralph-wiggum** | `harrymunro/ralph-wiggum` | Autonomous coding loops — keeps Claude working until real completion criteria are met |
| **context7** | `upstash/context7` | Injects real-time, up-to-date library documentation into Claude's context |
| **playwright-skill** | `lackeyjb/playwright-skill` | Browser automation — writes and executes Playwright scripts for E2E testing |
| **sentry-mcp** | `getsentry/sentry-mcp` | Error monitoring — query Sentry issues, traces, and performance data |
| **microsoft-playwright-mcp** | `microsoft/playwright-mcp` | Official Microsoft Playwright MCP server for browser control and debugging |

## Installation

### Claude Code

```bash
# Add this marketplace
/plugin marketplace add shouenlee/ghcp-dev-plugin

# Install a plugin
/plugin install code-review@ghcp-dev-plugins
/plugin install python-lint-fix@ghcp-dev-plugins
/plugin install test-gen@ghcp-dev-plugins
```

### GitHub Copilot CLI

```bash
# Add this marketplace
copilot plugin marketplace add shouenlee/ghcp-dev-plugin

# Install a plugin
copilot plugin install code-review@ghcp-dev-plugins
copilot plugin install python-lint-fix@ghcp-dev-plugins
copilot plugin install test-gen@ghcp-dev-plugins
```

## Usage

### Code Quality

```
/review                    # Review files changed in the working tree
/review src/               # Review all files in a directory
/lint                      # Run ruff + mypy + bandit on changed Python files
/security                  # Scan project for secrets and vulnerabilities
```

### Testing

```
/test-gen                  # Generate pytest tests for changed source files
/coverage                  # Run coverage report and identify gaps
```

### Git & PRs

```
/commit-changes            # Smart commit splitting by logical concern
/pr-desc                   # Generate structured PR description from branch diff
/review-pr 123             # Full code review of a pull request
/release notes             # Changelog from conventional commits since last tag
/release bump              # Semver bump based on commit types
/release publish           # Create GitHub release
```

### CI/CD & DevOps

```
/ci init                   # Generate GitHub Actions workflow for your project
/ci diagnose               # Fetch failing CI logs and explain the root cause
/docker init               # Generate Dockerfile + docker-compose.yml
/docker add postgres       # Add a service to your compose config
/docker optimize           # Check Dockerfile for anti-patterns
```

### Planning & Architecture

```
/design-doc                # Generate an RFC or ADR
/task-breakdown            # Decompose a feature into ordered subtasks
```

### Dependencies

```
/deps add requests         # Add a package and update dependency file
/deps audit                # Run pip-audit to find vulnerabilities
/deps unused               # Detect installed packages with no imports
```

### Incident Response

```
/incident triage <error>   # Search codebase for error origin, check recent deploys
/incident postmortem       # Generate structured postmortem document
/runbook                   # Generate operational runbook from infrastructure config
```

### Documentation

```
/api-docs generate         # Generate API docs from FastAPI routes or DRF viewsets
/api-docs diff             # Detect drift between code and existing docs
```

### Scaffolding

```
/scaffold                  # Generate Django/FastAPI boilerplate (endpoints, models, tasks)
/make-skill-template       # Scaffold a new Agent Skill
```

## Project Structure

```
ghcp-dev-plugin/
├── .claude-plugin/
│   └── marketplace.json              # Marketplace manifest (Claude Code)
├── .github/
│   └── plugin/
│       └── marketplace.json          # Marketplace manifest (Copilot CLI) — kept identical
├── plugins/
│   ├── <plugin-name>/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── skills/<skill-name>/SKILL.md
│   │   ├── agents/<name>.agent.md    # Optional
│   │   ├── hooks.json                # Optional
│   │   ├── references/               # Optional
│   │   └── templates/                # Optional
│   ├── code-review/
│   ├── security-check/
│   ├── make-skill-template/
│   ├── commit-changes/
│   ├── review-pr/
│   ├── python-lint-fix/
│   ├── test-gen/
│   ├── pr-description/
│   ├── ci-pipeline/
│   ├── release-notes/
│   ├── scaffold-app/
│   ├── docker-compose/
│   ├── design-doc/
│   ├── task-breakdown/
│   ├── dep-manager/
│   ├── incident-response/
│   └── api-docs/
├── CLAUDE.md
├── CONTRIBUTING.md
├── README.md
└── LICENSE
```

## License

MIT
