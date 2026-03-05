# Stage 2: Technical Spec & Design

## Purpose

Stage 2 transforms raw ticket requirements into a precise, reviewed technical specification and implementation plan. It explores the codebase to understand existing patterns and constraints, reasons about the best approach, and produces two documents:

1. **Technical Spec** — the "what and why" (requirements, affected components, approach, risks)
2. **Implementation Doc** — the "exactly how" (file paths, function signatures, test cases, step-by-step order)

Both documents go through multi-perspective review before the user approves them.

This is the most critical stage in the pipeline. A thorough spec prevents wasted implementation effort, catches design issues early, and gives the TDD stage (Stage 3) a concrete test plan to execute against.

## Input

- Parsed ticket from Stage 1 (`ticket.json` with title, description, acceptance criteria, labels)
- User's working codebase (current branch HEAD)

## Output

- Approved technical spec stored at `.claude/specs/{ticket-id}.md`
- Approved implementation doc stored at `.claude/specs/{ticket-id}-impl.md`
- Codebase context document stored at `.claude/specs/{ticket-id}-context.md`

---

## Options Comparison

| Criteria | A: Reuse `design-doc` plugin | B: Custom `spec_writer` agent | C: Team approach (researcher + architect) |
|---|---|---|---|
| **Implementation effort** | Low — already exists | Medium — new skill + agents | High — coordination logic |
| **Spec depth** | Generic design doc | Tailored to implementation needs | Deepest exploration |
| **Review quality** | Single-pass | Multi-perspective review team | Multi-perspective review team |
| **Codebase awareness** | Shallow (single agent) | Deep (parallel explorers) | Deepest (dedicated researchers) |
| **User experience** | Familiar format | Structured approval flow | Complex, many interactions |
| **Recommendation** | Fallback option | **RECOMMENDED** | Over-engineered for most tasks |

**Decision:** Option B — custom `spec_writer` skill with `spec-architect` and `impl-planner` agents, using Option A as a fallback for simpler tickets. The multi-explorer approach from Option C is incorporated into sub-stage 2A within Option B's flow.

---

## Sub-stages

### 2A: Deep Codebase Exploration (Team of Explorer Agents)

Before writing any spec, the pipeline builds a comprehensive understanding of the codebase areas affected by the ticket. This sub-stage spawns 3-5 Explore agents in parallel, each with a different focus.

#### Explorer Agents

| Agent | Focus | Output |
|---|---|---|
| **Entity Explorer** | Maps models, schemas, types, interfaces that will be touched or created | Entity map with field definitions, relationships, validation rules |
| **Dependency Explorer** | Traces import chains, API boundaries, downstream consumers of affected code | Dependency graph showing what depends on what, blast radius of changes |
| **Pattern Explorer** | Finds existing patterns for similar features (how was the last API endpoint added? how are tests structured?) | Pattern catalog with file references and code snippets |
| **Test Explorer** | Maps test structure, fixtures, mocks, coverage gaps in affected areas | Test inventory with coverage data, fixture locations, mock patterns |
| **Integration Explorer** | Identifies external services, APIs, databases, config files, environment variables | Integration map with connection details, auth patterns, config locations |

#### Agent Selection

Not every ticket needs all five explorers. The `spec_writer` skill selects agents based on ticket labels and content:

- **Bug fix:** Entity Explorer + Test Explorer + Pattern Explorer (3 agents)
- **New feature:** All 5 agents
- **Refactor:** Entity Explorer + Dependency Explorer + Pattern Explorer (3 agents)
- **API change:** Entity Explorer + Dependency Explorer + Integration Explorer (3 agents)

#### Codebase Context Document

Each explorer produces a structured report. These are merged into a single **Codebase Context Document** that serves as the foundation for all subsequent sub-stages:

```markdown
# Codebase Context: {ticket-id}

## Entity Map
- [Entity Explorer output]

## Dependency Graph
- [Dependency Explorer output]

## Existing Patterns
- [Pattern Explorer output]

## Test Landscape
- [Test Explorer output]

## External Integrations
- [Integration Explorer output]

## Key Observations
- [Cross-cutting findings that emerged from multiple explorers]
```

The context document is stored at `.claude/specs/{ticket-id}-context.md` for reference by later stages.

---

### 2B: High-Level Spec Generation

The `spec-architect` agent reads the ticket requirements and the Codebase Context Document, then produces the technical spec. This is the "what and why" document.

#### Spec Structure

```markdown
# Technical Spec: {ticket-title}
**Ticket:** {ticket-id}
**Author:** spec-architect agent
**Status:** Draft | In Review | Approved

## 1. Requirements Summary
- Restated requirements from the ticket
- Derived requirements inferred from codebase context
- Out-of-scope items explicitly listed

## 2. Affected Components
- Files, modules, services that will change
- New files or modules to create
- Components that will NOT change (and why)

## 3. Proposed Approach
- High-level description of the solution
- Key design decisions with rationale
- Alternative approaches considered and why they were rejected

## 4. API Changes
- New endpoints, modified signatures, changed payloads
- Backward compatibility notes

## 5. Data Model Changes
- Schema modifications, migrations needed
- Data backfill requirements

## 6. Risks and Mitigations
- Technical risks with severity and mitigation strategies
- Dependencies on external teams or services

## 7. Open Questions
- Ambiguities in requirements that need user input
- Design trade-offs that need a decision
```

#### User Interaction

After generating the spec, it is presented to the user for review. The user can:

- Ask questions about specific sections
- Request changes or alternatives
- Add constraints or requirements
- Say **"approved"** to proceed to 2C

---

### 2C: Spec Review (Team of 4 Reviewer Agents)

Once the user approves the high-level spec, it goes through automated multi-perspective review. Four reviewer agents run in parallel, each examining the spec through a different lens.

#### Reviewer Agents

**Maintainability Reviewer**
- Evaluates long-term sustainability of the proposed approach
- Checks for tech debt introduction, pattern consistency with codebase
- Flags deviations from established conventions found by the Pattern Explorer
- Assesses naming consistency, module boundaries, separation of concerns

**Security Reviewer**
- Checks for injection risks (SQL, command, XSS, template)
- Evaluates authentication and authorization gaps
- Identifies data exposure risks (PII in logs, secrets in config)
- References OWASP Top 10 against the proposed API and data changes
- Flags missing input validation or sanitization

**Efficiency Reviewer**
- Identifies potential N+1 query patterns
- Evaluates memory usage for large data sets
- Checks for unnecessary computation or redundant operations
- Assesses scalability under load (concurrent users, data growth)
- Flags missing caching opportunities or index needs

**Completeness Reviewer**
- Identifies missing edge cases (null inputs, empty collections, boundary values)
- Checks that all acceptance criteria from the ticket are addressed
- Flags ambiguities or assumptions that lack explicit handling
- Verifies error handling paths are specified
- Ensures rollback and failure recovery are considered

#### Review Output Format

Each reviewer produces comments with severity ratings:

| Severity | Meaning | Action Required |
|---|---|---|
| **CRITICAL** | Blocks implementation — must be resolved | Spec must be updated |
| **HIGH** | Significant issue — should be resolved | Spec should be updated |
| **MEDIUM** | Improvement opportunity — consider addressing | User decides |
| **LOW** | Minor suggestion — nice to have | Optional |

#### Consolidated Review

All reviewer comments are merged into a single review document, grouped by severity. The consolidated review is presented to the user with a summary:

```
Spec Review Complete:
- 0 CRITICAL issues
- 2 HIGH issues
- 3 MEDIUM suggestions
- 1 LOW suggestion

[Detailed comments follow]
```

The user reviews the feedback, discusses changes with Claude, and either:
- Updates the spec and re-runs the review
- Acknowledges findings and approves to proceed
- Overrides specific findings with rationale

---

### 2D: Detailed Implementation Document

After the spec is reviewed and approved, the `impl-planner` agent reads the approved spec and the Codebase Context Document to produce the implementation doc. This is the "exactly how" document.

#### Implementation Doc Structure

```markdown
# Implementation Plan: {ticket-title}
**Ticket:** {ticket-id}
**Spec:** .claude/specs/{ticket-id}.md
**Author:** impl-planner agent

## 1. File Changes

### New Files
| File Path | Purpose | Lines (est.) |
|---|---|---|

### Modified Files
| File Path | Line Range | Change Description |
|---|---|---|

## 2. Function/Method Signatures
- Exact signatures for new functions
- Modified signatures showing before/after
- Return types, parameter types, error types

## 3. Class/Type Definitions
- New classes, interfaces, structs with field definitions
- Modified type definitions showing additions/changes

## 4. Database Migrations
- Migration file name and contents
- Rollback migration
- Data backfill scripts if needed

## 5. Test Plan
| Test Case | Input | Expected Output | Type |
|---|---|---|---|
| (specific test cases from spec) | | | unit/integration/e2e |

## 6. Implementation Order
1. Step-by-step sequence with dependencies noted
2. Each step references specific files and functions
3. Checkpoint after each step (tests that should pass)

## 7. Rollback Plan
- How to revert each step independently
- Database rollback procedure
- Feature flag configuration (if applicable)
```

#### Granularity

The implementation doc is intentionally granular. It provides enough detail that the TDD agent (Stage 3) can execute mechanically — writing tests and code without needing to make design decisions. Every test case includes concrete inputs and expected outputs. Every file change includes the target line range.

---

### 2E: Implementation Doc Review

The same four reviewer agents from sub-stage 2C re-review the implementation document, this time with a different focus.

#### Shifted Review Focus

| Reviewer | Spec Review Focus (2C) | Impl Doc Review Focus (2E) |
|---|---|---|
| Maintainability | Is the approach sustainable? | Are the file/function boundaries clean? |
| Security | Are there vulnerability risks? | Are specific inputs validated? Are auth checks in place? |
| Efficiency | Will this scale? | Are queries indexed? Are loops bounded? |
| Completeness | Are requirements covered? | Are all steps present? Is the order correct? Are edge cases tested? |

Additional focus areas for 2E:
- **Feasibility:** Can each step actually be implemented as described?
- **Correctness:** Do the function signatures and types match the spec?
- **Ordering:** Are dependencies between steps properly sequenced?
- **Missing steps:** Are there implicit steps (imports, config changes, type registration) not listed?

#### Final Approval Gate

The consolidated review is presented to the user. This is the last gate before implementation begins. Once approved, the implementation doc is stored and Stage 3 (TDD) can proceed.

---

## Agent Specifications

The following agents are needed for Stage 2:

| Agent | File | Description |
|---|---|---|
| `SpecArchitect` | `agents/SpecArchitect.agent.md` | Reads ticket requirements and codebase context to produce the high-level technical spec. Focuses on the "what and why" — requirements, affected components, approach, risks, and open questions. |
| `ImplPlanner` | `agents/ImplPlanner.agent.md` | Reads the approved spec and codebase context to produce the detailed implementation doc. Focuses on the "exactly how" — file paths with line ranges, function signatures, test cases with inputs/outputs, and step-by-step implementation order. |
| `MaintainabilityReviewer` | `agents/MaintainabilityReviewer.agent.md` | Reviews specs and implementation docs for long-term sustainability, tech debt introduction, pattern consistency, and adherence to codebase conventions. |
| `SecurityReviewer` | `agents/SecurityReviewer.agent.md` | Reviews for injection risks, auth gaps, data exposure, OWASP Top 10 compliance, and missing input validation. |
| `EfficiencyReviewer` | `agents/EfficiencyReviewer.agent.md` | Reviews for N+1 queries, memory usage, unnecessary computation, scalability concerns, and missing caching or indexing. |
| `CompletenessReviewer` | `agents/CompletenessReviewer.agent.md` | Reviews for missing edge cases, uncovered acceptance criteria, ambiguities, error handling gaps, and rollback coverage. |

---

## Skill Specifications

| Skill | File | Description |
|---|---|---|
| `spec_writer` | `skills/spec_writer/SKILL.md` | Orchestrates the full 2A-2E flow: spawns explorer agents, generates spec via `spec-architect`, runs review team, generates implementation doc via `impl-planner`, runs final review. Manages user approval gates between sub-stages. |
| `spec_review` | `skills/spec_review/SKILL.md` | Runs the 4-agent review team on any document (spec or implementation doc). Can be invoked independently to re-review after changes. Produces consolidated review with severity ratings. |

---

## Collaboration Flow

```
User runs /swe {ticket-id}
    │
    ▼
Stage 1 produces ticket.json
    │
    ▼
spec-writer skill starts
    │
    ├── 2A: Spawn explorer agents (parallel) → Codebase Context Document
    │
    ├── 2B: spec-architect produces Technical Spec (draft)
    │         │
    │         ▼
    │       User reviews spec
    │       ├── Asks questions / requests changes → iterate
    │       └── Says "approved" → proceed
    │
    ├── 2C: spec-review runs 4 reviewers (parallel) → Consolidated Review
    │         │
    │         ▼
    │       User reviews findings
    │       ├── Updates spec → re-run review
    │       └── Approves → proceed
    │
    ├── 2D: impl-planner produces Implementation Doc
    │         │
    │         ▼
    │       User reviews impl doc
    │       ├── Requests changes → iterate
    │       └── Approves → proceed
    │
    ├── 2E: spec-review runs 4 reviewers on impl doc (parallel) → Consolidated Review
    │         │
    │         ▼
    │       User reviews findings
    │       ├── Updates impl doc → re-run review
    │       └── Approves → proceed to Stage 3
    │
    ▼
Spec + Impl Doc stored, Stage 3 begins
```

---

## Dependency Order

Every agent's inputs must exist before it runs. The table below traces each step's inputs back to the step that produces them.

| Step | Component | Inputs Required | Produced By | Output File |
|---|---|---|---|---|
| 2A | Explore subagents (parallel) | `ticket.json` | Stage 1 | — |
| 2A | spec-writer (merge) | Explorer outputs | 2A explorers | `.claude/specs/{ticket-id}-context.md` |
| 2B | SpecArchitect | `ticket.json`, `{ticket-id}-context.md` | Stage 1, 2A | `.claude/specs/{ticket-id}.md` |
| — | User approval gate | `{ticket-id}.md` | 2B | — |
| 2C | spec-review → 4 reviewers (parallel) | `{ticket-id}.md`, `ticket.json`, `{ticket-id}-context.md` | 2B, Stage 1, 2A | `.claude/specs/{ticket-id}-review-spec.md` |
| — | User approval gate | `{ticket-id}-review-spec.md` | 2C | — |
| 2D | ImplPlanner | `{ticket-id}.md`, `{ticket-id}-context.md` | 2B, 2A | `.claude/specs/{ticket-id}-impl.md` |
| — | User approval gate | `{ticket-id}-impl.md` | 2D | — |
| 2E | spec-review → 4 reviewers (parallel) | `{ticket-id}-impl.md`, `ticket.json`, `{ticket-id}-context.md` | 2D, Stage 1, 2A | `.claude/specs/{ticket-id}-review-impl.md` |
| — | Final user approval gate | `{ticket-id}-review-impl.md` | 2E | — |

The flow is strictly sequential (2A → 2B → 2C → 2D → 2E) with user approval gates between each step, so no agent runs before its inputs exist. Within 2A and 2C/2E, agents run in parallel but share no write dependencies — explorers produce independent output sections, and reviewers produce independent reviews consolidated by the orchestrator after all complete.

### Stage 3: TDD Implementation

| Step | Component | Inputs Required | Produced By | Output File |
|---|---|---|---|---|
| 3A | TddEngineer | `{ticket-id}.md`, `{ticket-id}-impl.md`, `{ticket-id}-context.md` | Stage 2 (2B, 2D, 2A) | Commits on current branch |
| 3B | TddEngineer (summary) | All TDD steps complete | TddEngineer agent | `.claude/swe-state/{ticket-id}/impl-summary.md` |

---

## Spec Storage

All Stage 2 artifacts are stored under `.claude/specs/`:

| File | Contents |
|---|---|
| `.claude/specs/{ticket-id}-context.md` | Codebase Context Document from 2A |
| `.claude/specs/{ticket-id}.md` | Approved Technical Spec from 2B/2C |
| `.claude/specs/{ticket-id}-impl.md` | Approved Implementation Doc from 2D/2E |
| `.claude/specs/{ticket-id}-review-spec.md` | Consolidated spec review from 2C |
| `.claude/specs/{ticket-id}-review-impl.md` | Consolidated impl doc review from 2E |

These files are read by Stage 3 (TDD Implementation) and referenced in the final PR description (Stage 5).
