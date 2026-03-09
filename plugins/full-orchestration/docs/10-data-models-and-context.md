# 10 — Data Models & Context Passing

Complete reference for every data structure, artifact file, and context handoff in the `/swe` pipeline.

---

## Pipeline State File

**Path**: `.claude/swe-state/{ticket-id}.json`

This is the primary coordination mechanism. Every stage reads it at start, merges its outputs at end. No stage overwrites prior stage data.

### Full Schema

```json
{
  "ticket_id": "PROJ-123",
  "target_branch": "main",
  "feature_branch": "feat/PROJ-123",
  "current_stage": "intake | spec | implement_and_review | pr",
  "status": "in_progress | failed | aborted | completed",
  "stages": {
    "intake": {
      "completed": false,
      "ticket_file": ".claude/swe-state/PROJ-123/ticket.json"
    },
    "spec": {
      "completed": false,
      "spec_file": ".claude/specs/PROJ-123.md",
      "impl_plan_file": ".claude/specs/PROJ-123-impl.md",
      "context_file": ".claude/specs/PROJ-123-context.md",
      "spec_review_iterations": 0,
      "impl_review_iterations": 0
    },
    "implement": {
      "completed": false,
      "impl_summary_file": ".claude/swe-state/PROJ-123/impl-summary.md",
      "test_results": {
        "new_tests": 0,
        "modified_tests": 0,
        "total_suite": null,
        "coverage": null
      }
    },
    "review": {
      "completed": false,
      "approved": false,
      "iterations": 0,
      "phase": "pending | reviewing | capped | complete",
      "review_iteration_file": ".claude/swe-state/PROJ-123/review-iteration.md",
      "review_summary_file": ".claude/swe-state/PROJ-123/review-summary.md",
      "findings": {
        "critical": { "total": 0, "fixed": 0, "dismissed": 0 },
        "major": { "total": 0, "fixed": 0, "auto_fixed": 0, "dismissed": 0 },
        "minor": { "total": 0, "fixed": 0, "auto_fixed": 0 },
        "suggestions": 0,
        "dismissed": []
      }
    },
    "pr": {
      "completed": false,
      "pr_number": null,
      "pr_url": null,
      "title": null,
      "labels": [],
      "ticket_updated": false,
      "reviewers_requested": false
    }
  }
}
```

### Who Reads / Writes What

| Field | Written By | Read By |
|---|---|---|
| `ticket_id` | `/swe` (init) | All stages |
| `target_branch` | `/swe` (init) | `implement_and_review`, `pr_create` |
| `feature_branch` | `/swe` (init), `implement_and_review` (confirms) | `implement_and_review`, `pr_create` |
| `current_stage` | `/swe` (each dispatch) | — |
| `status` | `/swe` (each dispatch) | — |
| `stages.intake.*` | `ticket_intake` | `spec_writer` |
| `stages.spec.*` | `spec_writer` | `implement_and_review` |
| `stages.implement.*` | `implement_and_review` | `pr_create` |
| `stages.review.*` | `implement_and_review` | `pr_create` |
| `stages.pr.*` | `pr_create` | `/swe` (completion) |

### Status Values

| Value | Meaning |
|---|---|
| `in_progress` | A stage is currently running |
| `failed` | A stage encountered an error |
| `aborted` | User chose to abort at a gate |
| `completed` | All stages finished successfully |

### Write Semantics

Every skill follows this contract:

1. Read the state file from disk
2. Deep-merge its own fields into the existing object
3. Never overwrite fields from prior stages
4. Write the merged result back

---

## Stage 1: Ticket Intake

### Ticket Data

**Path**: `.claude/swe-state/{ticket-id}/ticket.json`

```json
{
  "ticket_id": "PROJ-123",
  "source": "jira | linear | github | generic",
  "url": "https://myorg.atlassian.net/browse/PROJ-123",
  "title": "Add rate limiting to API endpoints",
  "description": "Full ticket body text...",
  "acceptance_criteria": [
    "API returns 429 when rate limit exceeded",
    "Rate limits are configurable per endpoint"
  ],
  "comments": [
    {
      "author": "jane.doe",
      "body": "Should we use sliding window or fixed window?",
      "timestamp": "2026-02-15T10:30:00Z"
    }
  ],
  "linked_issues": [
    {
      "id": "PROJ-100",
      "relationship": "blocks",
      "title": "API performance improvements"
    }
  ],
  "labels": ["enhancement", "api"],
  "priority": "High",
  "assignee": "john.smith",
  "affected_areas": [
    {
      "path": "src/middleware/rate-limiter.ts",
      "category": "existing",
      "reason": "Rate limiter module mentioned in description"
    },
    {
      "path": "src/middleware/rate-limiter.test.ts",
      "category": "test",
      "reason": "Existing test file for rate limiter"
    },
    {
      "path": "src/config/rate-limits.ts",
      "category": "new",
      "reason": "Configuration file referenced but doesn't exist"
    }
  ]
}
```

### Field Sources by Ticketing System

| Field | Jira | Linear | GitHub Issues |
|---|---|---|---|
| `ticket_id` | Issue key (`PROJ-123`) | Issue ID (`LIN-456`) | Issue number (`42`) |
| `source` | `"jira"` | `"linear"` | `"github"` |
| `url` | Extracted from URL or constructed | Extracted from URL | Constructed from repo |
| `title` | `summary` field | `title` field | `title` field |
| `description` | `description` field | `description` field | `body` field |
| `acceptance_criteria` | Parsed from description | Parsed from description | Parsed from body |
| `comments` | `comment` field array | `comments` array | `comments` from `gh` |
| `labels` | `labels` field | `labels` field | `labels` from `gh` |
| `priority` | `priority.name` | `priority` | Inferred from labels |
| `assignee` | `assignee.displayName` | `assignee.name` | `assignees[0].login` |

### Fetch Methods

| System | Method | Command / Tool |
|---|---|---|
| Jira | MCP | `getJiraIssue` with `issueIdOrKey` |
| Linear | MCP | `linear_get_issue` with `issueId` |
| GitHub | CLI | `gh issue view <N> --json title,body,comments,labels,assignees,milestone` |
| Generic | User-provided | curl command or API endpoint |

### Acceptance Criteria Extraction

Parsed from description text by searching for:

- Lines starting with `- [ ]` or `- [x]`
- Numbered lists after headings containing "Acceptance Criteria", "AC", "Requirements", or "Definition of Done"
- Bullet lists in sections titled "Expected Behavior" or "Success Criteria"

---

## Stage 2: Spec & Design

Stage 2 has 5 sub-stages (2A–2E) producing 3 artifact files. All are stored under `.claude/specs/`.

### 2A — Codebase Context Document

**Path**: `.claude/specs/{ticket-id}-context.md`
**Producer**: `spec_writer` orchestrator (merges explorer outputs)
**Consumers**: SpecArchitect (2B), ImplPlanner (2D), TddEngineer (Stage 3), implement_and_review review-fix loop (Stage 3)

```markdown
# Codebase Context: {ticket-id}

## Entity Map
Models, schemas, types, interfaces that will be touched or created.
Fields, relationships, validation rules, file locations.

## Dependency Graph
Import chains, API boundaries, downstream consumers.
Blast radius of changes.

## Existing Patterns
How similar features were implemented, coding conventions.
File references and code snippets.

## Test Landscape
Test structure, test file locations, fixture patterns, mock patterns.
Existing tests by type (unit/integration/e2e) and coverage gaps.

## External Integrations
External services, APIs, databases, config files, environment variables.
Connection details, auth patterns, config locations.

## Key Observations
Cross-cutting findings that emerged from multiple explorers.
```

#### Explorer Agent Selection

Which explorers run depends on ticket labels:

| Ticket Type | Labels | Explorers | Count |
|---|---|---|---|
| Bug fix | `bug`, `fix`, `bugfix` | Entity + Test + Pattern | 3 |
| New feature | `feature`, `enhancement` | Entity + Dependency + Pattern + Test + Integration | 5 |
| Refactor | `refactor`, `cleanup`, `tech-debt` | Entity + Dependency + Pattern | 3 |
| API change | `api`, `endpoint`, `rest`, `graphql` | Entity + Dependency + Integration | 3 |
| Default | (no matching labels) | Entity + Dependency + Pattern + Test | 4 |

All explorers are prompt-only `Explore` subagents (built-in Claude Code agent type). They are spawned in a SINGLE message for parallel execution.

#### Explorer Prompts (summarized)

| Explorer | Focus | Output Section |
|---|---|---|
| **Entity** | Models, schemas, types, interfaces, fields, relationships | Entity Map |
| **Dependency** | Import chains, API boundaries, blast radius | Dependency Graph |
| **Pattern** | Similar implementations, coding conventions, file organization | Existing Patterns |
| **Test** | Test structure, fixtures, mocks, coverage gaps | Test Landscape |
| **Integration** | External services, APIs, databases, config, env vars | External Integrations |

### 2B — Technical Spec

**Path**: `.claude/specs/{ticket-id}.md`
**Producer**: `SpecArchitect` agent
**Consumers**: ImplPlanner (2D), spec_review (2C), TddEngineer (Stage 3), pr_create (Stage 4)

```markdown
# Technical Spec: {ticket-title}
**Ticket:** {ticket-id}
**Author:** SpecArchitect agent
**Status:** Draft

## 1. Requirements Summary
Restated requirements, derived requirements, out-of-scope items.

## 2. Affected Components
Files/modules that will change (with file:line refs).
New files to create. Components that won't change.

## 3. Proposed Approach
High-level solution, design decisions with rationale,
rejected alternatives, fit with existing patterns.

## 4. API Changes
New endpoints, modified signatures, backward compat notes.

## 5. Data Model Changes
Schema modifications, migrations, data backfill.

## 6. Risks and Mitigations
Technical risks (HIGH/MEDIUM/LOW), external dependencies,
performance implications.

## 7. Open Questions
Ambiguities needing user input, design trade-offs.
```

#### SpecArchitect Agent

| Property | Value |
|---|---|
| Agent file | `agents/SpecArchitect.agent.md` |
| Model | `opus` |
| Tools | Read, Grep, Edit, Write |
| Reads | `ticket.json`, `{ticket-id}-context.md`, referenced source files |
| Writes | `.claude/specs/{ticket-id}.md` |

### 2C — Spec Review (Inline Comments)

**Producer**: `spec_review` skill (4 reviewers insert inline comments into `{ticket-id}.md`)
**Consumer**: `spec_writer` (counts OPEN comments, spawns SpecArchitect to address them)

No separate review file. Reviewers insert blockquote comments directly into the spec:

```
> **[{SEVERITY} | {ReviewerName} | OPEN]** {comment text}
```

After the review-fix loop converges (0 OPEN comments or 5 rounds), `spec_writer` strips all remaining RESOLVED markers before presenting to the user.

### 2E — Implementation Plan Review (Inline Comments)

**Producer**: `spec_review` skill (same skill, impl mode — reviewers insert inline comments into `{ticket-id}-impl.md`)
**Consumer**: `spec_writer` (counts OPEN comments, spawns ImplPlanner to address them)

Same inline comment mechanics as 2C. No separate review file.

#### Reviewer Agents

All four are spawned in a SINGLE message for parallel execution.

| Agent | File | Model | Perspective | Checklist Focus |
|---|---|---|---|---|
| MaintainabilityReviewer | `agents/MaintainabilityReviewer.agent.md` | sonnet | Sustainability | Complexity, SoC, naming, coupling, pattern deviation, testability, readability |
| SecurityReviewer | `agents/SecurityReviewer.agent.md` | sonnet | Attack surface | Injection, auth gaps, authorization, data exposure, input validation, insecure defaults, OWASP |
| EfficiencyReviewer | `agents/EfficiencyReviewer.agent.md` | sonnet | Performance | N+1 queries, allocations, caching, unbounded ops, data structures, indexes, resource leaks |
| CompletenessReviewer | `agents/CompletenessReviewer.agent.md` | sonnet | Coverage | AC traceability, edge cases, error handling, rollback, missing steps, test coverage gaps |

Each reviewer produces findings with the same severity scale: CRITICAL / HIGH / MEDIUM / LOW.

#### Review Mode Behavior

Each reviewer operates in two modes determined by the document path:

| Mode | Trigger | Focus |
|---|---|---|
| `spec` | Path matches `{ticket-id}.md` | Design-level review (2C) |
| `impl` | Path matches `{ticket-id}-impl.md` | Step-level review (2E) |

Detection: ticket ID = everything before first known suffix (`-impl.md`, `-context.md`).

### 2D — Implementation Plan

**Path**: `.claude/specs/{ticket-id}-impl.md`
**Producer**: `ImplPlanner` agent
**Consumers**: spec_review (2E), TddEngineer (Stage 3), implement_and_review review-fix loop (Stage 3), pr_create (Stage 4)

```markdown
# Implementation Plan: {ticket-title}
**Ticket:** {ticket-id}
**Spec:** .claude/specs/{ticket-id}.md
**Author:** ImplPlanner agent

## 1. File Changes
### New Files
| File Path | Purpose | Lines (est.) |

### Modified Files
| File Path | Line Range | Change Description |

## 2. Function/Method Signatures
Exact signatures for new/modified functions.

## 3. Type/Interface Definitions
New types, modified types, referenced types.

## 4. Database Migrations
Migration file name, complete SQL (up/down), backfill scripts.

## 5. Test Plan
| # | Test Case | Input | Expected Output | Type |

## 6. Implementation Order
### Step 1: {description}
**Files:** path
**Test first:** test file and case name
**Then implement:** what code to write
**Checkpoint:** which tests pass after this step

### Step N: ...

## 7. Rollback Plan
Revert procedure, down migrations, feature flags.
```

#### ImplPlanner Agent

| Property | Value |
|---|---|
| Agent file | `agents/ImplPlanner.agent.md` |
| Model | `opus` |
| Tools | Read, Glob, Grep, Edit, Write |
| Reads | `{ticket-id}.md` (spec), `{ticket-id}-context.md`, every file it plans to reference |
| Writes | `.claude/specs/{ticket-id}-impl.md` |

---

## Stage 3: Implement & Review

Stage 3 is managed by a single skill — `implement_and_review` — which handles TDD implementation followed by a review-fix loop. Both `stages.implement` and `stages.review` state sections are written by this skill.

### Implementation Summary

**Path**: `.claude/swe-state/{ticket-id}/impl-summary.md`
**Producer**: `TddEngineer` agent (via `implement_and_review`)
**Consumers**: `implement_and_review` (review-fix loop), `pr_create` (Stage 4)

```markdown
# Implementation Summary: {ticket-id}

## Branch
feat/PROJ-123

## Changes
| File | Lines Changed | Description |

## Test Results
- New tests: N
- Modified tests: N
- Total test suite: PASS/FAIL
- Coverage: X% (if available)

## Deviations from Plan
- Any differences from the implementation doc, with rationale

## Notes for Review
- Areas that need extra scrutiny
- Trade-offs made during implementation
```

#### TddEngineer Agent

| Property | Value |
|---|---|
| Agent file | `agents/TddEngineer.agent.md` |
| Model | `opus` |
| Tools | Read, Grep, Glob, Edit, Write, Bash |
| Reads | `{ticket-id}.md`, `{ticket-id}-impl.md`, `{ticket-id}-context.md`, `review-iteration.md` (during fix loop) |
| Writes | `.claude/swe-state/{ticket-id}/impl-summary.md`, code commits on feature branch |

#### TDD Cycle Per Step

```
RED   → Write failing test → run tests → confirm expected failure
GREEN → Write minimal code → run tests → confirm pass (max 5 attempts)
REFACTOR → Clean up → run full suite → confirm no regressions
COMMIT → "feat({scope}): {what} [TDD step N/{total}]"
```

#### Test Runner Detection

| Language | Runners | Config Files |
|---|---|---|
| Python | pytest | `pyproject.toml`, `pytest.ini`, `setup.cfg` |
| JS/TS | Jest, Vitest, Mocha | `jest.config.js`, `vitest.config.ts`, `.mocharc.yml`, `package.json` |
| Go | go test | `go.mod` |
| Rust | cargo test | `Cargo.toml` |
| Java | JUnit (Maven/Gradle) | `pom.xml`, `build.gradle` |
| Ruby | RSpec, Minitest | `.rspec`, `Gemfile` |
| C# | dotnet test | `*.csproj`, `*.sln` |
| PHP | PHPUnit | `phpunit.xml` |
| Elixir | ExUnit | `mix.exs` |
| Swift | XCTest | `Package.swift` |

#### Commit Convention

| Scenario | Message Format |
|---|---|
| TDD step | `feat({scope}): {what} [TDD step N/{total}]` |
| Dependency install | `chore: add {package} dependency` |
| Blocked step | `WIP: {step description}` |
| Review fix | `review: fix {severity} — {short description}` |

#### Error Handling

| Scenario | Behavior |
|---|---|
| Red: test fails for wrong reason | Fix test, re-run |
| Green: fails after 5 attempts | WIP commit, note blocker, continue if possible |
| Refactor: regression | Revert refactor, commit pre-refactor, note in summary |
| Full suite: unrelated failure | Investigate; if pre-existing, note in summary |

### Deep-Review Context File (ephemeral)

**Path**: `/tmp/deep_review-${CLAUDE_SESSION_ID}-context.yaml`
**Producer**: `deep_review` skill (Phase 1)
**Consumers**: Advocate, Skeptic, Architect agents
**Lifecycle**: Created before agents spawn, deleted after synthesis

```yaml
review:
  type: branch_diff
  base: main
  head: feat/PROJ-123
  title: <summary>
  description: <details>

changed_files:
  - path: src/middleware/rate-limiter.ts
    action: edit
    content: |
      <full new file content>

existing_feedback:           # optional
  - author: <who>
    location: <file:line>
    comment: <text>

observations:
  - <orchestrator notes>
```

### Deep-Review Output: Structured Findings Block

Appended to the human-readable review as a machine-readable YAML comment block. This is the **schema contract** between `deep_review` (producer) and `implement_and_review` (consumer).

```markdown
<!-- structured-findings
findings:
  - id: 1
    priority: critical | high | medium | low
    file: src/middleware/rate-limiter.ts
    line: 42
    summary: "Missing input validation on rate limit config"
    agents: [skeptic, architect]
  - id: 2
    priority: medium
    file: src/config/rate-limits.ts
    line: null
    summary: "Config values not validated at startup"
    agents: [skeptic]
structured-findings -->
```

#### Schema Contract Fields

| Field | Type | Allowed Values |
|---|---|---|
| `id` | integer | Sequential from 1 |
| `priority` | string | `critical`, `high`, `medium`, `low` |
| `file` | string | Relative path from repo root |
| `line` | integer or null | Line number, or null if not applicable |
| `summary` | string | One-line description |
| `agents` | list of strings | `advocate`, `skeptic`, `architect` |

#### Deep-Review Agents

| Agent | Plugin | Model | Perspective |
|---|---|---|---|
| Advocate | `deep-review:Advocate` | (per agent def) | "Why is this correct?" — trust boundaries, design rationale |
| Skeptic | `deep-review:Skeptic` | (per agent def) | "How can I break this?" — bugs, edge cases, code smells |
| Architect | `deep-review:Architect` | (per agent def) | "Is this the right direction?" — system impact, structural smells |

### Severity Mapping (deep-review → pipeline)

| deep-review Priority | Pipeline Severity | Action |
|---|---|---|
| Critical | **Critical** | Breaks auto-loop — user decides: fix, dismiss, or abort |
| High | **Major** | Auto-fix via TddEngineer with full state context; no user input required |
| Medium | **Minor** | Auto-fix via TddEngineer with full state context; demote to suggestion if fix fails |
| Low | **Suggestion** | Collect for follow-up items; does not block convergence |

### Review Iteration File

**Path**: `.claude/swe-state/{ticket-id}/review-iteration.md`
**Producer**: `implement_and_review` skill (each iteration, overwritten)

Contains the consolidated review from the latest iteration with severity classifications.

### Review Summary

**Path**: `.claude/swe-state/{ticket-id}/review-summary.md`
**Producer**: `implement_and_review` skill (Phase 4)
**Consumers**: `pr_create` (Stage 4)

```
Code Review Complete: {ticket-id}

Iterations: {N}
Branch: {feature-branch}

Resolved:
  - {count} Critical, {count} Major, {count} Minor fixed

Remaining:
  - {count} dismissed (with rationale)

Follow-up Items:
  - {suggestion}

Tests: {PASS/FAIL} after review fixes
```

### Auto-Fix Context Passing (Full State Reference)

In the review-fix loop, when Major or Minor findings need auto-fixing, `implement_and_review` spawns TddEngineer with a **full-context prompt** that references the state file:

```
subagent_type: full-orchestration:TddEngineer
prompt: |
  State file: .claude/swe-state/{ticket-id}.json
  Read state to locate:
  - stages.spec.spec_file
  - stages.spec.impl_plan_file
  - stages.spec.context_file
  - stages.implement.impl_summary_file
  - stages.review.review_iteration_file
  Findings to fix:
  {list with id, file:line, severity, summary}
  {user direction for Critical fixes if any}
  For each: write/update test, apply fix, run tests.
  Commit: "review: fix {severity} — {description}"
  Run full suite when done.
  Write updated summary to impl_summary_file.
```

This ensures the TddEngineer always has access to the original spec, implementation plan, and codebase context when applying review fixes — not just the scoped finding list.

### User-Directed Iterate Context Passing

When the user chooses "Iterate" at the approval gate, `implement_and_review` spawns TddEngineer with the same full state reference plus user direction:

```
subagent_type: full-orchestration:TddEngineer
prompt: |
  State file: .claude/swe-state/{ticket-id}.json
  Iterating on implementation based on code review feedback.

  Read state to locate all inputs:
  - stages.spec.spec_file (original spec)
  - stages.spec.impl_plan_file (original plan)
  - stages.spec.context_file (codebase context)
  - stages.implement.impl_summary_file (previous impl summary)
  - stages.review.review_iteration_file (latest review feedback)

  User direction:
    {verbatim user instruction}

  Read the review feedback and impl summary to understand what
  needs to change. Use TDD. Keep all existing tests passing.
  Commit: "review: fix {severity} — {description}"
  Run full suite when done.
  Write updated summary to the impl_summary_file path from state.
```

After TddEngineer completes, return to the review-fix loop.

### Review Phase Tracking

The `stages.review.phase` field tracks progression:

| Phase Value | Meaning |
|---|---|
| `pending` | Implementation not yet reviewed |
| `reviewing` | Review-fix loop in progress |
| `capped` | Hit iteration cap without convergence |
| `complete` | User approved at gate |

---

## Stage 4: PR Creation

### PR Content (generated, not persisted as file)

| Component | Source |
|---|---|
| **Title** | `{type}({ticket-id}): {description}` — under 72 chars |
| **Labels** | Mapped from change type (enhancement, bug, refactor, docs, test, security) |
| **Body** | Assembled from pipeline artifacts (see below) |

### PR Body Template

```markdown
## Summary
{2-3 sentence summary}
Resolves [{ticket-id}]({ticket-url})

## Spec
**Goal**: {from spec}
**Approach**: {from spec}
**Key decisions**: {from spec}

## Changes
- `{file}` — {description}

## Test Results
Tests:  {passed} passed, {failed} failed
Suites: {suite-count} passed

## Review Summary
Reviewed by: {reviewer agents}
| Finding | Severity | Resolution |

## Checklist
- [x] Tests pass locally
- [x] Code review completed ({N} iterations)
- [x] No critical or major findings remaining
- [ ] CI pipeline (pending)
```

### PR Body Data Sources

| Section | Read From |
|---|---|
| Summary | `.claude/specs/{ticket-id}.md` (spec) + `ticket.json` |
| Resolves link | `ticket.json` → `url` field |
| Spec | `.claude/specs/{ticket-id}.md` |
| Changes | `.claude/swe-state/{ticket-id}/impl-summary.md` |
| Test Results | `.claude/swe-state/{ticket-id}/impl-summary.md` |
| Review Summary | `.claude/swe-state/{ticket-id}/review-summary.md` |

### Ticket Status Updates (non-fatal)

| System | Method | Action |
|---|---|---|
| Jira | MCP `transitionJiraIssue` + `addCommentToJiraIssue` | Transition to "In Review" + comment with PR URL |
| Linear | MCP `linear_update_issue` + `linear_add_comment` | Update status to "In Review" + comment with PR URL |
| GitHub | `gh issue comment` | Comment with PR URL (auto-linked via `Resolves #N`) |

---

## Complete Artifact Map

### Persistent Files

| Path | Created By | Read By | Lifecycle |
|---|---|---|---|
| `.claude/swe-state/{ticket-id}.json` | `/swe` (init), all stages (merge) | All stages | Entire pipeline |
| `.claude/swe-state/{ticket-id}/ticket.json` | `ticket_intake` | `spec_writer`, `spec_review`, `pr_create` | Entire pipeline |
| `.claude/specs/{ticket-id}-context.md` | `spec_writer` (2A) | SpecArchitect, ImplPlanner, TddEngineer, `implement_and_review` review-fix loop | Entire pipeline |
| `.claude/specs/{ticket-id}.md` | SpecArchitect (2B) | spec_review (2C), ImplPlanner (2D), TddEngineer, `implement_and_review` review-fix loop, pr_create | Entire pipeline |
| `.claude/specs/{ticket-id}-impl.md` | ImplPlanner (2D) | spec_review (2E), TddEngineer, `implement_and_review` review-fix loop, pr_create | Entire pipeline |
| `.claude/swe-state/{ticket-id}/impl-summary.md` | TddEngineer (via `implement_and_review`) | `implement_and_review` review-fix loop, `pr_create` | Stage 3 onward |
| `.claude/swe-state/{ticket-id}/review-iteration.md` | `implement_and_review` (overwritten each iteration) | `implement_and_review` (approval gate), TddEngineer (fix context) | Stage 3 |
| `.claude/swe-state/{ticket-id}/review-summary.md` | `implement_and_review` | `pr_create` | Stage 3 onward |

### Ephemeral Files

| Path | Created By | Read By | Lifecycle |
|---|---|---|---|
| `/tmp/deep_review-${CLAUDE_SESSION_ID}-context.yaml` | `deep_review` | Advocate, Skeptic, Architect | Deleted after synthesis |

---

## Context Flow Diagram

```
Stage 1                    Stage 2                      Stage 3: Implement & Review        Stage 4
─────────────────────────────────────────────────────────────────────────────────────────────────────

ticket.json ──────────────► spec_writer
                            │
                            ├─ 2A: Explorers ──► context.md ──┐
                            │                                  │
                            ├─ 2B: SpecArchitect ──► spec.md ─┤
                            │                           │      │
                            │                           ▼      │
                            ├─ 2B↔2C: review-fix loop  │      │
                            │                          │      │
                            ├─ 2D: ImplPlanner ──► impl.md ───┤
                            │                        │         │
                            │                        ▼         │
                            └─ 2D↔2E: review-fix loop          │
                                                               │
                                                               ▼
                                                    implement_and_review
                                                    ┌──────────────────┐
                                                    │ TddEngineer      │
                                                    │ (initial impl)   │
                                                    │      │           │
                                                    │      ▼           │
                                                    │ impl-summary.md  │
                                                    │      │           │
                                                    │      ▼           │
                                                    │ Review-Fix Loop  │◄──┐
                                                    │  deep_review     │   │
                                                    │  (full branch)   │   │
                                                    │      │           │   │
                                                    │      ▼           │   │
                                                    │  Parse findings  │   │
                                                    │      │           │   │
                                                    │  TddEngineer     │   │
                                                    │  (fix w/ full    │   │
                                                    │   state context) │───┘
                                                    │      │           │
                                                    │      ▼           │
                                                    │ review-summary ──┼──► pr_create
                                                    └──────────────────┘

                                                    deep_review (ephemeral)
                                                        │
                                                        ├─ context.yaml ──► Advocate
                                                        ├─ context.yaml ──► Skeptic
                                                        └─ context.yaml ──► Architect
                                                                │
                                                                ▼
                                                      structured-findings
                                                      (in review output)
                                                                │
                                                                ▼
                                                    implement_and_review
                                                    parses and maps severity
```

---

## Agent Summary

| Agent | Plugin | Model | Tools | Role |
|---|---|---|---|---|
| Explore (×3-5) | built-in | — | Read-only | Codebase exploration (2A) |
| SpecArchitect | full-orchestration | opus | Read, Grep, Edit, Write | Spec authoring (2B) + fix comments (2C) |
| MaintainabilityReviewer | full-orchestration | sonnet | Read, Grep, Edit | Spec/plan review (2C/2E) |
| SecurityReviewer | full-orchestration | sonnet | Read, Grep, Edit | Spec/plan review (2C/2E) |
| EfficiencyReviewer | full-orchestration | sonnet | Read, Grep, Edit | Spec/plan review (2C/2E) |
| CompletenessReviewer | full-orchestration | sonnet | Read, Grep, Edit | Spec/plan review (2C/2E) |
| ImplPlanner | full-orchestration | opus | Read, Glob, Grep, Edit, Write | Impl planning (2D) + fix comments (2E) |
| TddEngineer | full-orchestration | opus | Read, Grep, Glob, Edit, Write, Bash | Implementation (3) + review fixes (3, with full state context) |
| Advocate | deep-review | (per def) | Read-only | Code review — defense (3) |
| Skeptic | deep-review | (per def) | Read-only | Code review — attack (3) |
| Architect | deep-review | (per def) | Read-only | Code review — direction (3) |

---

## User Approval Gates

| Stage | Gate | What User Reviews | Options |
|---|---|---|---|
| 1 | After intake | Parsed ticket summary | Confirm / Edit / Re-fetch |
| 2B↔2C | After spec review-fix loop | Clean spec (review comments resolved and stripped) | Approve / Request changes |
| 2D↔2E | After impl plan review-fix loop | Clean impl plan (review comments resolved and stripped) | Approve / Request changes |
| 3 | After review-fix loop | Final review + remaining findings | Approve / Iterate / Abort |
| 4 | Before PR creation | PR title, labels, body preview | Create / Edit / Cancel |
| 4 | Before push | `git push -u origin {branch}` | Confirm / Cancel |
