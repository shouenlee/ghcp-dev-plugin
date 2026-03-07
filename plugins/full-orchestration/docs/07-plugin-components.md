# 07 — Plugin File Specifications

A complete reference of every file in the `full-orchestration` plugin: metadata, skills, agents, hooks, and marketplace entry.

## File Tree

```
plugins/full-orchestration/
├── .claude-plugin/
│   └── plugin.json                          # Plugin metadata
├── skills/
│   ├── swe/
│   │   └── SKILL.md                         # Main orchestrator skill
│   ├── ticket_intake/
│   │   └── SKILL.md                         # Stage 1: ticket fetching
│   ├── spec_writer/
│   │   └── SKILL.md                         # Stage 2: spec orchestration
│   ├── spec_review/
│   │   └── SKILL.md                         # Stage 2C/2E: review team
│   ├── tdd_implement/
│   │   └── SKILL.md                         # Stage 3: TDD implementation
│   ├── code_review/
│   │   └── SKILL.md                         # Stage 4: code review
│   └── pr_create/
│       └── SKILL.md                         # Stage 5: PR creation
├── agents/
│   ├── SpecArchitect.agent.md               # Stage 2B: spec generation
│   ├── ImplPlanner.agent.md                # Stage 2D: implementation planning
│   ├── TddEngineer.agent.md               # Stage 3: TDD implementation
│   ├── MaintainabilityReviewer.agent.md    # Reviewer: maintainability
│   ├── SecurityReviewer.agent.md           # Reviewer: security
│   ├── EfficiencyReviewer.agent.md         # Reviewer: performance
│   └── CompletenessReviewer.agent.md       # Reviewer: completeness
├── hooks.json                               # Event-based suggestions
├── docs/                                    # Documentation (this directory)
└── README.md                                # Plugin overview
```

## plugin.json

Location: `plugins/full-orchestration/.claude-plugin/plugin.json`

```json
{
  "name": "full-orchestration",
  "description": "Fully agentic software engineering pipeline — from ticket intake through spec design, TDD implementation, code review, and PR creation. Orchestrates multiple agents and skills across five stages.",
  "version": "1.0.0",
  "author": {
    "name": "shouenlee",
    "email": "shouenlee@users.noreply.github.com"
  },
  "license": "MIT",
  "keywords": ["orchestration", "agentic", "tdd", "code-review", "spec", "pipeline", "software-engineering"]
}
```

## hooks.json

Location: `plugins/full-orchestration/hooks.json`

```json
{
  "hooks": [
    {
      "event": "after_command",
      "pattern": "^gh issue view",
      "action": "suggest",
      "message": "Tip: Use /swe to start the full software engineering pipeline for this ticket."
    },
    {
      "event": "after_edit",
      "pattern": "\\.(py|js|ts|go|rs|java|rb)$",
      "action": "suggest",
      "message": "Source file modified. Run tests to verify your changes."
    }
  ]
}
```

Two hooks:
1. **after_command** — Fires after `gh issue view` and suggests using `/swe` for the ticket.
2. **after_edit** — Fires after editing source files and reminds to run tests.

---

## Skills

### swe/SKILL.md

Location: `plugins/full-orchestration/skills/swe/SKILL.md`

```yaml
---
name: swe
description: >-
  Run the full software engineering pipeline from ticket to PR.
  Use when starting a feature, fixing a bug from a ticket, or
  driving end-to-end development from a Jira, Linear, or GitHub
  issue. Accepts a ticket ID or URL as argument and orchestrates
  intake, spec design, TDD implementation, code review, and PR
  creation with approval gates at each stage.
---
```

**Body contains:** The full orchestration logic — argument parsing (`--from=STAGE`), state file management (`.claude/swe-state/{ticket-id}.json`), sequential invocation of each stage skill/agent, approval gate prompts between stages, error handling and resumption instructions.

### ticket_intake/SKILL.md

Location: `plugins/full-orchestration/skills/ticket_intake/SKILL.md`

```yaml
---
name: ticket_intake
description: >-
  Fetch and parse a ticket from Jira, Linear, or GitHub Issues.
  Use when starting work on a ticket, beginning a new feature,
  or when given a ticket ID or issue URL. Accepts a ticket ID
  or full URL as argument, auto-detects the ticketing system,
  and produces a structured requirements summary.
---
```

**Body contains:** Instructions for auto-detecting the ticketing system from the input, fetching ticket data via MCP (Jira/Linear) or `gh` CLI (GitHub Issues), extracting structured fields (title, description, acceptance criteria, comments, labels), searching the codebase for affected areas, and presenting a summary for user approval.

### spec_writer/SKILL.md

Location: `plugins/full-orchestration/skills/spec_writer/SKILL.md`

```yaml
---
name: spec_writer
description: >-
  Generate a technical spec and implementation plan for a ticket. Use
  when you have parsed requirements and need a detailed design before
  implementation. Orchestrates codebase exploration, spec authoring,
  autonomous review-fix loops, implementation planning, and plan
  review-fix loops across multiple agents.
---
```

**Body contains:** Instructions for orchestrating Stage 2: (2A) spawning 3-5 explorer subagents, (2B) invoking SpecArchitect to produce a spec, (2B↔2C) running an autonomous review-fix loop where 4 reviewers insert inline comments and SpecArchitect addresses them (max 5 rounds), (2D) invoking ImplPlanner to produce a step-by-step plan, (2D↔2E) running the same review-fix loop with ImplPlanner as author. Strips resolved comment markers before presenting clean docs to the user.

### spec_review/SKILL.md

Location: `plugins/full-orchestration/skills/spec_review/SKILL.md`

```yaml
---
name: spec_review
description: >-
  Run a four-agent inline comment review on a technical spec or
  implementation plan. Use when a spec or plan needs evaluation
  from maintainability, security, efficiency, and completeness
  perspectives. Spawns four reviewer agents that insert OPEN
  blockquote comments directly into the document.
---
```

**Body contains:** Instructions for spawning four reviewer agents in parallel, each using Edit to insert inline blockquote comments (`> **[SEVERITY | Reviewer | OPEN]**`) directly into the document under review. Counts OPEN comments by severity and reports to the caller. No separate review document is produced.

### tdd_implement/SKILL.md

Location: `plugins/full-orchestration/skills/tdd_implement/SKILL.md`

```yaml
---
name: tdd_implement
description: >-
  Implement a ticket using test-driven development. Use when you
  have an approved spec and implementation plan and are ready to
  write code. Spawns a TDD engineer agent on a feature branch.
---
```

**Body contains:** Instructions for validating prerequisite files (spec, implementation plan, codebase context), spawning the TDD engineer agent to execute the implementation plan using strict red/green/refactor methodology on a feature branch, reporting results (branch, test counts, coverage, deviations), and updating pipeline state. Handles agent failure, missing summaries, and WIP commits.

### code_review/SKILL.md

Location: `plugins/full-orchestration/skills/code_review/SKILL.md`

```yaml
---
name: code_review
description: >-
  Run adversarial code review with auto-converging fix loop. Use when you
  have a completed implementation branch ready for review before PR
  creation. Delegates to deep-review for three-agent analysis, auto-fixes
  Minor and Major findings, pauses only on Critical, and runs a final
  validation review before gating user approval.
---
```

**Body contains:** Instructions for validating that Stage 3 is complete, running a three-phase auto-converging review loop: Phase 2A (full branch diff review), Phase 2B (incremental fix loop on changes only, up to 5 iterations), Phase 2C (final full-branch validation). Auto-fixes Minor and Major findings via TddEngineer, pauses only on Critical for user decision, and gates approval before Stage 5.

### pr_create/SKILL.md

Location: `plugins/full-orchestration/skills/pr_create/SKILL.md`

```yaml
---
name: pr_create
description: >-
  Create a pull request from a reviewed implementation branch.
  Use when Stage 4 code review is approved and you are ready
  to open a PR. Generates a conventional-commit title, structured
  body with ticket link, spec summary, test results, and review
  findings, then creates the PR via gh CLI.
---
```

**Body contains:** Instructions for validating that Stage 4 review is approved, gathering pipeline artifacts (impl summary, review summary, spec, test results), generating a conventional-commit PR title and structured body, previewing for user confirmation, pushing the branch and creating the PR via `gh pr create`, applying labels, updating the source ticket status via MCP (Jira/Linear) or `gh` CLI (GitHub Issues), requesting reviewers from CODEOWNERS, and updating pipeline state. Ticket updates and reviewer requests are non-fatal.

---

## Agents

### SpecArchitect.agent.md

Location: `plugins/full-orchestration/agents/SpecArchitect.agent.md`

```yaml
---
name: SpecArchitect
description: 'Synthesizes codebase exploration findings into a detailed technical specification'
model: opus
---
```

**Role:** Receives the ticket requirements and codebase exploration results from Stage 2A. Produces a structured technical spec covering: problem statement, proposed approach, affected components, data model changes, API changes, edge cases, and testing strategy. Writes the spec as a markdown document.

**Tools used:** Read (to examine code referenced by explorers), Grep (to verify assumptions about existing patterns), Edit (to address review comments inline during 2B↔2C loop), Write (to produce the spec document).

**Behavior:** Prioritizes clarity and completeness. Explicitly calls out assumptions, risks, and open questions. Structures the spec so reviewers can evaluate each section independently.

### ImplPlanner.agent.md

Location: `plugins/full-orchestration/agents/ImplPlanner.agent.md`

```yaml
---
name: ImplPlanner
description: 'Converts a technical spec into a step-by-step implementation plan with file-level changes'
model: opus
---
```

**Role:** Takes the reviewed technical spec from Stage 2C and produces a detailed implementation plan. Each step specifies: the file(s) to modify or create, what changes to make, the test(s) to write for that step, and the expected behavior after the step is complete.

**Tools used:** Read (to examine current file contents), Glob (to verify file paths), Grep (to find existing patterns to follow), Edit (to address review comments inline during 2D↔2E loop).

**Behavior:** Produces steps ordered for TDD — each step starts with the test, then the implementation. Follows existing code conventions discovered during exploration. Keeps steps small enough for incremental verification.

### TddEngineer.agent.md

Location: `plugins/full-orchestration/agents/TddEngineer.agent.md`

```yaml
---
name: TddEngineer
description: 'Implements features using test-driven development on a feature branch'
model: opus
---
```

**Role:** Executes the implementation plan from Stage 2D using strict TDD methodology on a feature branch. For each step: writes the failing test, runs it to confirm it fails, writes the implementation, runs the test to confirm it passes, then moves to the next step. Runs the full test suite at the end.

**Tools used:** Read, Edit, Write (code changes), Bash (running tests, git operations), Grep, Glob (navigating the codebase).

**Behavior:** Works on the current branch and follows the implementation plan step by step. If a test fails unexpectedly, diagnoses and fixes before proceeding. Commits incrementally after each passing step. Reports back with a summary of all changes, test results, and any deviations from the plan.

### MaintainabilityReviewer.agent.md

Location: `plugins/full-orchestration/agents/MaintainabilityReviewer.agent.md`

```yaml
---
name: MaintainabilityReviewer
description: 'Reviews specs and plans for long-term maintainability, readability, and code health'
model: sonnet
---
```

**Role:** Evaluates technical specs and implementation plans from a maintainability perspective. Checks for: unnecessary complexity, poor separation of concerns, unclear naming, missing documentation needs, coupling issues, and deviation from existing codebase patterns.

**Tools used:** Read (to compare against existing code patterns), Grep (to check consistency with conventions), Edit (to insert inline review comments into the document).

**Behavior:** Produces a structured review with findings rated by severity (critical, warning, suggestion). Focuses on whether the proposed changes will be easy to understand, modify, and debug six months from now. Inserts findings as inline blockquote comments directly into the document under review.

### SecurityReviewer.agent.md

Location: `plugins/full-orchestration/agents/SecurityReviewer.agent.md`

```yaml
---
name: SecurityReviewer
description: 'Reviews specs and plans for security vulnerabilities, unsafe patterns, and OWASP risks'
model: sonnet
---
```

**Role:** Evaluates technical specs and implementation plans for security concerns. Checks for: injection vulnerabilities (SQL, command, XSS), authentication/authorization gaps, data exposure risks, insecure defaults, missing input validation at system boundaries, and OWASP Top 10 issues.

**Tools used:** Read (to examine existing security patterns), Grep (to find related auth/validation code), Edit (to insert inline review comments into the document).

**Behavior:** Produces a structured review with findings rated by severity. Focuses on attack surface changes introduced by the proposed design. References OWASP categories where applicable. Inserts findings as inline blockquote comments directly into the document under review.

### EfficiencyReviewer.agent.md

Location: `plugins/full-orchestration/agents/EfficiencyReviewer.agent.md`

```yaml
---
name: EfficiencyReviewer
description: 'Reviews specs and plans for performance bottlenecks, resource usage, and scalability'
model: sonnet
---
```

**Role:** Evaluates technical specs and implementation plans for performance and efficiency. Checks for: N+1 query patterns, unnecessary allocations, missing caching opportunities, unbounded operations, inefficient data structures, and scalability concerns under load.

**Tools used:** Read (to examine existing performance patterns), Grep (to find related database/caching code), Edit (to insert inline review comments into the document).

**Behavior:** Produces a structured review with findings rated by severity. Focuses on whether the proposed approach will perform acceptably at expected scale. Suggests concrete alternatives for identified bottlenecks. Inserts findings as inline blockquote comments directly into the document under review.

### CompletenessReviewer.agent.md

Location: `plugins/full-orchestration/agents/CompletenessReviewer.agent.md`

```yaml
---
name: CompletenessReviewer
description: 'Reviews specs and plans for missing requirements, edge cases, and untested scenarios'
model: sonnet
---
```

**Role:** Evaluates technical specs and implementation plans for completeness. Checks for: unaddressed acceptance criteria from the ticket, missing edge cases, unhandled error scenarios, gaps in test coverage, missing migration steps, and incomplete rollback plans.

**Tools used:** Read (to cross-reference the ticket requirements with the spec), Edit (to insert inline review comments into the document).

**Behavior:** Produces a structured review with findings rated by severity. Cross-references every acceptance criterion from the ticket against the spec and plan to ensure nothing is missed. Identifies edge cases the spec author may not have considered. Inserts findings as inline blockquote comments directly into the document under review.

---

## Marketplace Entry

The following entry must appear in both marketplace manifest files:

- `.claude-plugin/marketplace.json`
- `.github/plugin/marketplace.json`

```json
{
  "name": "full-orchestration",
  "description": "Fully agentic software engineering pipeline — from ticket intake through spec design, TDD implementation, code review, and PR creation",
  "version": "1.0.0",
  "author": {
    "name": "shouenlee",
    "email": "shouenlee@users.noreply.github.com"
  },
  "source": "./plugins/full-orchestration",
  "category": "workflow",
  "tags": ["orchestration", "agentic", "tdd", "code-review", "spec", "pipeline", "software-engineering"]
}
```

## Cross-References

- [00 — System Overview](00-overview.md) — Architecture and pipeline diagram
- [06 — Orchestrator Skill](06-orchestrator.md) — How `/swe` coordinates all components
- [08 — Setup Guide](08-setup-guide.md) — Installation and configuration
