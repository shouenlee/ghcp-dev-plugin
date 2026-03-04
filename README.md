# ghcp-dev-plugins

A cross-platform plugin marketplace for **Claude Code** and **GitHub Copilot CLI**.

Both tools share compatible plugin systems, so every plugin in this marketplace works with either tool out of the box.

## Available Plugins

### Custom Plugins

| Plugin | Category | Components | Description |
|--------|----------|------------|-------------|
| **code-review** | code-quality | skill, agent | Analyzes code for bugs, security issues, performance problems, and readability |
| **make-skill-template** | development | skill | Scaffolds new Agent Skills with proper frontmatter and directory structure |
| **commit-changes** | git | skill, hook | Reviews diffs and creates well-structured commits, splitting by logical concern |
| **gh-pr-tools** | git | 4 skills, hook | GitHub PR tools — review PRs, resolve comments, check thread status, create PRs |
| **python-lint-fix** | code-quality | skill, hook, reference | Runs ruff + mypy + bandit on Python files, explains violations, auto-fixes |
| **ci-pipeline** | workflow | skill, agent, hook | Generates GitHub Actions workflows and diagnoses CI failures |
| **release-notes** | git | skill, hook | Generates changelogs, bumps semver, publishes GitHub releases |
| **docker-compose** | development | skill, hook | Generates Dockerfiles and compose configs, adds services, checks anti-patterns |
| **design-doc** | docs | skill, agent, hook | Generates RFCs and ADRs with consistent numbering and format |
| **task-breakdown** | workflow | skill, hook | Decomposes features/issues into ordered subtasks with acceptance criteria |
| **dep-manager** | development | skill, hook | Manages Python deps — add, remove, audit vulnerabilities, detect unused |
| **api-docs** | docs | skill, hook | Generates API docs from FastAPI/DRF code and detects documentation drift |
| **deep-wiki** | docs | 8 skills, 3 agents | AI-powered wiki generator — Mermaid diagrams, onboarding guides, VitePress sites |
| **deep-review** | code-quality | skill, 3 agents | Adversarial code review with parallel Advocate, Skeptic, and Architect subagents |
| **full-orchestration** | workflow | docs | Fully agentic SWE pipeline — ticket intake, spec, TDD, review, and PR creation |

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
/plugin install deep-review@ghcp-dev-plugins
```

### GitHub Copilot CLI

```bash
# Add this marketplace
copilot plugin marketplace add shouenlee/ghcp-dev-plugin

# Install a plugin
copilot plugin install code-review@ghcp-dev-plugins
copilot plugin install python-lint-fix@ghcp-dev-plugins
copilot plugin install deep-review@ghcp-dev-plugins
```

## Usage

### Code Quality

```
/review                    # Review files changed in the working tree
/review src/               # Review all files in a directory
/lint                      # Run ruff + mypy + bandit on changed Python files
/deep-review               # Adversarial multi-agent code review
```

### Testing

```
/swe PROJ-123              # Full pipeline: ticket → spec → TDD → review → PR
```

### Git & PRs

```
/commit-changes            # Smart commit splitting by logical concern
/pr-create                 # Create a PR from the current branch
/pr-review 123             # Full code review of a pull request
/pr-status 123             # Check review thread statuses
/resolve-pr 123            # Resolve open PR review threads
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

### Documentation

```
/api-docs generate         # Generate API docs from FastAPI routes or DRF viewsets
/api-docs diff             # Detect drift between code and existing docs
/deep-wiki                 # Generate structured wiki with Mermaid diagrams
```

### Scaffolding

```
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
│   ├── api-docs/
│   ├── ci-pipeline/
│   ├── code-review/
│   ├── commit-changes/
│   ├── deep-review/
│   ├── deep-wiki/
│   ├── dep-manager/
│   ├── design-doc/
│   ├── docker-compose/
│   ├── full-orchestration/
│   ├── gh-pr-tools/
│   ├── make-skill-template/
│   ├── python-lint-fix/
│   ├── release-notes/
│   └── task-breakdown/
├── CLAUDE.md
├── CONTRIBUTING.md
├── README.md
└── LICENSE
```

## License

MIT
