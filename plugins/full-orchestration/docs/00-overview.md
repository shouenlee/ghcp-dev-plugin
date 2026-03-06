# 00 — System Overview

## What This Is

`full-orchestration` is a fully agentic software engineering pipeline for Claude Code. Given a ticket ID, it drives the entire workflow — from requirements gathering through PR creation — across five stages, each with a human-in-the-loop approval gate.

The goal: eliminate the manual glue between "here's a ticket" and "here's a reviewed PR." You stay in control at every stage; the plugin handles the orchestration.

## Architecture

```
                         /swe TICKET-ID
                              │
                              ▼
               ┌──────────────────────────┐
               │   Stage 1: Ticket Intake  │
               │   (MCP: Jira/Linear/GH)   │
               └────────────┬─────────────┘
                            │ ✅ User approves requirements
                            ▼
               ┌──────────────────────────┐
               │   Stage 2: Spec & Design  │
               │                          │
               │  2A  Explorer Team (3-5)  │
               │       ▼                  │
               │  2B  Spec Architect       │
               │       ▼                  │
               │  2C  Spec Review Team (4) │
               │       ▼                  │
               │  2D  Impl Planner         │
               │       ▼                  │
               │  2E  Impl Doc Review      │
               └────────────┬─────────────┘
                            │ ✅ User approves spec + impl plan
                            ▼
               ┌──────────────────────────┐
               │ Stage 3: TDD Implement.   │
               │   (TddEngineer agent)    │
               │   Feature branch           │
               └────────────┬─────────────┘
                            │ ✅ User approves implementation
                            ▼
               ┌──────────────────────────┐
               │  Stage 4: Code Review     │
               │  (deep-review plugin)     │
               │  skeptic + advocate +     │
               │  architect agents         │
               └────────────┬─────────────┘
                            │ ✅ User approves review
                            ▼
               ┌──────────────────────────┐
               │  Stage 5: PR Creation     │
               │  (gh CLI)                 │
               └──────────────────────────┘
```

## Built-in vs Plugin Additions

| Capability | Claude Code (built-in) | This plugin adds |
|-----------|----------------------|------------------|
| Read/write files | Yes | -- |
| Run shell commands | Yes | -- |
| Git operations | Yes | -- |
| Create PRs (`gh` CLI) | Yes | -- |
| Multi-agent orchestration | Yes (subagents) | Coordinated 5-stage pipeline with approval gates |
| Ticket ingestion | No | MCP-based fetch from Jira, Linear, GitHub Issues |
| Codebase exploration team | No | 3-5 parallel explorer agents that map affected areas |
| Spec authoring & review | No | Structured spec with 4-reviewer adversarial review |
| TDD workflow | No | Test-first implementation on a feature branch |
| Adversarial code review | Partially (single perspective) | Multi-agent review via `deep-review` plugin |
| End-to-end orchestration | No | Single `/swe` command drives the full pipeline |

## Pipeline Flow

1. **Ticket Intake** — Fetches ticket from Jira, Linear, or GitHub Issues. Parses requirements and acceptance criteria. Presents a summary for user confirmation.

2. **Spec & Design** — An explorer team fans out across the codebase to identify affected areas. The spec architect synthesizes findings into a technical spec. A review team of four specialists (maintainability, security, efficiency, completeness) evaluates the spec. An implementation planner produces a step-by-step build plan. A final review validates the plan.

3. **TDD Implementation** — A `TddEngineer` agent works on the current branch. Writes failing tests first, then implements until tests pass. Runs the full test suite before reporting back.

4. **Code Review** — Delegates to the `deep-review` plugin. Three agents (skeptic, advocate, architect) review the diff from independent perspectives and produce a consolidated assessment.

5. **PR Creation** — Creates a PR via the `gh` CLI with a structured description, links the original ticket, and includes the review summary.

Each stage transition is an **approval gate**: the pipeline pauses, shows you the output, and waits for explicit confirmation before proceeding.

## Quick Start

```bash
# 1. Install the plugin
/plugin install full-orchestration@ghcp-dev-plugin

# 2. (Optional) Configure MCP for your ticketing system
# Jira:
claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse

# Linear:
claude mcp add --transport sse linear-server https://mcp.linear.app/sse

# GitHub Issues: no setup needed (uses gh CLI)

# 3. Run the pipeline
/swe PROJ-123
```

## Documentation Index

| Doc | Contents |
|-----|----------|
| [01 — Ticket Intake](01-ticket-intake.md) | Stage 1: fetching and parsing tickets |
| [02 — Spec & Design](02-spec-design.md) | Stage 2: exploration, spec authoring, review |
| [03 — TDD Implementation](03-tdd-implementation.md) | Stage 3: test-first implementation workflow |
| [04 — Code Review](04-code-review.md) | Stage 4: multi-agent adversarial review |
| [05 — PR Creation](05-pr-creation.md) | Stage 5: PR creation and ticket linking |
| [06 — Orchestrator Skill](06-orchestrator.md) | The `/swe` entry point and stage coordination |
| [07 — Plugin Components](07-plugin-components.md) | Full inventory of skills, agents, and hooks |
| [08 — Setup Guide](08-setup-guide.md) | Installation, MCP configuration, prerequisites |
| [09 — Improvements](09-improvements.md) | Future ideas and known limitations |
| [10 — Data Models & Context](10-data-models-and-context.md) | State schema, artifact files, context flow |
