# Inline Comment Review Loops Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the separate-review-doc flow in Stage 2 with autonomous inline comment review loops where reviewers comment directly in spec/impl docs and authors address them until convergence.

**Architecture:** Reviewer agents gain Edit tool access to insert blockquote comments (`> **[SEVERITY | Reviewer | STATUS]**`) directly into the document under review. `spec_writer` orchestrates a 2B↔2C loop (spec) and 2D↔2E loop (impl plan), each running up to 5 rounds. `spec_review` becomes a pure inline-comment inserter (no separate review doc output). Separate review files (`-review-spec.md`, `-review-impl.md`) and `review-context.md` are eliminated.

**Tech Stack:** Markdown skills/agents (no runtime code — this is a Claude Code plugin)

**Design doc:** `docs/plans/2026-03-06-inline-comment-review-loops-design.md`

---

### Task 1: Update the four reviewer agents to use inline comments

All four reviewer agents need the same changes: add Edit tool, replace the "Output Format" section with inline comment insertion instructions.

**Files:**
- Modify: `plugins/full-orchestration/agents/MaintainabilityReviewer.agent.md`
- Modify: `plugins/full-orchestration/agents/SecurityReviewer.agent.md`
- Modify: `plugins/full-orchestration/agents/EfficiencyReviewer.agent.md`
- Modify: `plugins/full-orchestration/agents/CompletenessReviewer.agent.md`

**Context:** Each agent currently has an "Output Format" section that produces a standalone markdown review. The new behavior inserts blockquote comments directly into the document using the Edit tool. The comment format is:

```
> **[{SEVERITY} | {ReviewerName} | OPEN]** {comment text}
```

Placed immediately after the relevant paragraph or section in the document.

**What to change in EACH agent file:**

1. **Keep** the frontmatter (`name`, `description`, `model`) unchanged
2. **Keep** the opening paragraph, "Dual-Mode Review" section, and "Checklist" section unchanged
3. **Replace** the "Output Format" section with a new "Review Method" section:

```markdown
## Review Method

You review by inserting inline comments directly into the document using the Edit tool.

### Comment Format

```
> **[{SEVERITY} | {YourAgentName} | OPEN]** {comment text}
```

- **Severity**: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
- **Status**: Always `OPEN` when you insert a new comment
- Place each comment immediately after the paragraph or section it refers to
- One comment per concern — do not bundle multiple issues

### On Re-Review

When re-reviewing a document that already has comments:
- **RESOLVED comments from you**: Read the surrounding text. If the fix is adequate, delete the entire blockquote line. If not, change `RESOLVED` back to `OPEN` and optionally update the comment text.
- **OPEN comments from you**: Leave unchanged if still valid. Delete if no longer applicable.
- **Comments from other reviewers**: Do not touch them.
- **New issues**: Insert new `OPEN` comments as normal.

### What NOT To Do

- Do not produce a standalone review document
- Do not modify the document's content (only insert/remove/update comment blockquotes)
- Do not delete or edit other reviewers' comments
```

4. **Replace** the final "Tone:" line with:

```markdown
Report when done: count of OPEN comments you inserted or kept, count you removed.
```

**Verification:**
- Each agent file should contain `> **[{SEVERITY} |` in its Review Method section
- Each agent file should mention "Edit tool" in its Review Method
- No agent file should contain "Output Format" or "Verdict" sections
- The frontmatter, Dual-Mode Review, and Checklist sections should be unchanged

**Commit:**
```bash
git add plugins/full-orchestration/agents/MaintainabilityReviewer.agent.md plugins/full-orchestration/agents/SecurityReviewer.agent.md plugins/full-orchestration/agents/EfficiencyReviewer.agent.md plugins/full-orchestration/agents/CompletenessReviewer.agent.md
git commit -m "refactor(agents): switch 4 reviewer agents to inline comment format with Edit tool"
```

---

### Task 2: Rewrite spec_review skill for inline comments

Replace the three-phase (gather context → parallel review → consolidation) flow with a simpler two-phase flow: spawn 4 reviewers that edit the doc directly, then count OPEN comments.

**Files:**
- Modify: `plugins/full-orchestration/skills/spec_review/SKILL.md`

**Current file:** `plugins/full-orchestration/skills/spec_review/SKILL.md` (86 lines)

**Replace the ENTIRE body** (everything after the frontmatter closing `---`) with:

```markdown
# Spec Review

**State file**: `.claude/swe-state/{ticket-id}.json`

Four parallel reviewer agents insert inline comments directly into the document under review.

## Usage

```
/spec_review .claude/specs/PROJ-123.md          # Spec review (2C)
/spec_review .claude/specs/PROJ-123-impl.md     # Impl plan review (2E)
```

---

## Phase 1: Gather Context

**Detect mode** from path: `{ticket-id}.md` → spec mode, `{ticket-id}-impl.md` → impl mode. Extract ticket ID (everything before first known suffix).

**Read state** to get: `stages.intake.ticket_file` and `stages.spec.context_file`.

**Read**: document under review (required), ticket.json (if available), context doc (if available).

---

## Phase 2: Parallel Inline Review

Spawn FOUR agents in a SINGLE message:

```
subagent_type: full-orchestration:{ReviewerName}
prompt: |
  Review this document by inserting inline comments: {doc_path}

  Supporting context:
  - Ticket: {ticket_file path from state}
  - Codebase context: {context_file path from state}

  Review mode: {spec|impl}
  Read the document and supporting files, then insert your review comments
  as inline blockquotes using your standard comment format.
```

Agents: `MaintainabilityReviewer`, `SecurityReviewer`, `EfficiencyReviewer`, `CompletenessReviewer`.

On agent failure: log warning, proceed with remaining agents.

---

## Phase 3: Count and Report

After all agents complete, read the document and count blockquote comments matching:

```
> **[{SEVERITY} | {Reviewer} | OPEN]**
```

Report to caller:
- Count by severity: CRITICAL, HIGH, MEDIUM, LOW
- Total OPEN comments
- No verdict — the caller (spec_writer) decides convergence
```

**Verification:**
- File should NOT contain `review-context.md`, `spec_review_file`, `impl_review_file`, `Consolidation`, or `Verdict`
- File SHOULD contain `inline comments`, `OPEN`, `count blockquote`
- Phase count should be 3 (Gather Context, Parallel Inline Review, Count and Report)

**Commit:**
```bash
git add plugins/full-orchestration/skills/spec_review/SKILL.md
git commit -m "refactor(spec_review): switch to inline comment insertion, remove separate review docs"
```

---

### Task 3: Rewrite spec_writer skill with review-fix loops

This is the most substantial change. Replace the linear 2A→2B→gate→2C→gate→2D→gate→2E→gate flow with 2A→2B→(2B↔2C loop)→gate→2D→(2D↔2E loop)→gate.

**Files:**
- Modify: `plugins/full-orchestration/skills/spec_writer/SKILL.md`

**Current file:** `plugins/full-orchestration/skills/spec_writer/SKILL.md` (113 lines)

**Keep the frontmatter but update the description:**

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

**Replace the ENTIRE body** with:

```markdown
# Spec Writer

**State file**: `.claude/swe-state/{ticket-id}.json`

Orchestrate Stage 2: explore codebase, generate spec, review-fix loop, produce implementation plan, review-fix loop.

## Usage

```
/spec_writer <ticket-id>
```

Read `stages.intake.ticket_file` from state to locate the ticket. If `stages.intake.completed` is not true, tell the user to run `/ticket_intake` first.

---

## 2A: Codebase Exploration

Read ticket.json and extract `title`, `description`, `acceptance_criteria`, `labels`.

Select explorers based on labels:

| Ticket Type | Explorers | Count |
|---|---|---|
| Bug fix (`bug`, `fix`, `bugfix`) | Entity + Test + Pattern | 3 |
| New feature (`feature`, `enhancement`) | Entity + Dependency + Pattern + Test + Integration | 5 |
| Refactor (`refactor`, `cleanup`, `tech-debt`) | Entity + Dependency + Pattern | 3 |
| API change (`api`, `endpoint`, `rest`, `graphql`) | Entity + Dependency + Integration | 3 |
| Default | Entity + Dependency + Pattern + Test | 4 |

Spawn all selected explorers as `subagent_type: Explore` in a SINGLE message. Each gets:

```
Explore the codebase to find {topic} relevant to this ticket.
Ticket: {title} — {description}
Find: {search items}
Output a structured "{Section Name}" section.
```

| Explorer | Topic | Search Items | Output Section |
|---|---|---|---|
| Entity | entities | models, schemas, types, interfaces, fields, relationships | Entity Map |
| Dependency | dependencies | import chains, API boundaries, blast radius | Dependency Graph |
| Pattern | patterns | similar implementations, conventions, file organization | Existing Patterns |
| Test | test landscape | test structure, fixtures, mocks, coverage gaps | Test Landscape |
| Integration | integrations | external services, APIs, databases, config, env vars | External Integrations |

Merge outputs into `.claude/specs/{ticket-id}-context.md` (path from `stages.spec.context_file` in state).

---

## 2B: Spec Generation

```
subagent_type: full-orchestration:SpecArchitect
prompt: |
  Ticket: {ticket_file path from state}
  Context: {context_file path from state}
  Write spec to: {spec_file path from state}
```

---

## 2B↔2C: Spec Review-Fix Loop (max 5 rounds)

Autonomous loop — no user interaction until convergence or cap.

### Loop

```
iteration = 0
WHILE iteration < 5:
    iteration += 1

    1. Run /spec_review {spec_file path from state}
       → Returns OPEN comment count by severity

    2. IF 0 OPEN comments → CONVERGED → break

    3. Spawn author agent to address comments:
       subagent_type: full-orchestration:SpecArchitect
       prompt: |
         Review comments have been added to: {spec_file}

         Read the document. For each comment marked OPEN:
         1. Understand the reviewer's concern
         2. Modify the relevant section to address it
         3. Change the comment status from OPEN to RESOLVED

         Do NOT delete comments. Do NOT add new content beyond
         addressing the comments. Do NOT change sections with no comments.

         When done, report: number of comments addressed, any you
         couldn't resolve (with explanation).

    4. Continue loop (next iteration re-reviews)

IF iteration == 5 AND OPEN comments remain:
    Report: "Spec review did not fully converge after 5 rounds.
    {N} OPEN comments remain."
```

### Cleanup

After loop exits (converged or capped):
1. Read the spec file
2. Remove all remaining blockquote comment lines matching `> **[...|RESOLVED]**`
3. Write the cleaned file back

Update state: `stages.spec.spec_review_iterations = {iteration count}`

### User Gate

Present the clean spec to the user. If OPEN comments remained at cap, show them separately.

User chooses: **Approve** → proceed to 2D. **Request changes** → user provides direction, re-enter loop.

---

## 2D: Implementation Planning

```
subagent_type: full-orchestration:ImplPlanner
prompt: |
  Spec: {spec_file path from state}
  Context: {context_file path from state}
  Write plan to: {impl_plan_file path from state}
```

---

## 2D↔2E: Impl Plan Review-Fix Loop (max 5 rounds)

Same loop mechanics as 2B↔2C, but targeting the implementation plan.

### Loop

```
iteration = 0
WHILE iteration < 5:
    iteration += 1

    1. Run /spec_review {impl_plan_file path from state}
       → Returns OPEN comment count by severity

    2. IF 0 OPEN comments → CONVERGED → break

    3. Spawn author agent to address comments:
       subagent_type: full-orchestration:ImplPlanner
       prompt: |
         Review comments have been added to: {impl_plan_file}

         Read the document. For each comment marked OPEN:
         1. Understand the reviewer's concern
         2. Modify the relevant section to address it
         3. Change the comment status from OPEN to RESOLVED

         Do NOT delete comments. Do NOT add new content beyond
         addressing the comments. Do NOT change sections with no comments.

         When done, report: number of comments addressed, any you
         couldn't resolve (with explanation).

    4. Continue loop (next iteration re-reviews)

IF iteration == 5 AND OPEN comments remain:
    Report: "Impl plan review did not fully converge after 5 rounds.
    {N} OPEN comments remain."
```

### Cleanup

After loop exits (converged or capped):
1. Read the impl plan file
2. Remove all remaining blockquote comment lines matching `> **[...|RESOLVED]**`
3. Write the cleaned file back

Update state: `stages.spec.impl_review_iterations = {iteration count}`

### User Gate

Present the clean impl plan to the user. If OPEN comments remained at cap, show them separately.

User chooses: **Approve** → proceed to Stage 3. **Request changes** → user provides direction, re-enter loop.

---

## Update State

Set `stages.spec.completed = true`. All file paths are already in state from initialization.
```

**Verification:**
- File should contain `2B↔2C` and `2D↔2E` loop sections
- File should contain `max 5 rounds` in both loop headers
- File should contain `OPEN` and `RESOLVED` comment status references
- File should contain cleanup step (strip `RESOLVED` blockquotes)
- File should NOT contain `spec_review_file` or `impl_review_file` references
- The 2A section should be identical to the original

**Commit:**
```bash
git add plugins/full-orchestration/skills/spec_writer/SKILL.md
git commit -m "feat(spec_writer): add autonomous review-fix loops for 2B↔2C and 2D↔2E"
```

---

### Task 4: Update /swe initial state

Remove `spec_review_file` and `impl_review_file` from `stages.spec`, add `spec_review_iterations` and `impl_review_iterations`.

**Files:**
- Modify: `plugins/full-orchestration/skills/swe/SKILL.md`

**Exact change** — in the `stages.spec` block of the initial state JSON (around lines 79-85), replace:

```json
    "spec": {
      "completed": false,
      "spec_file": ".claude/specs/{ticket-id}.md",
      "impl_plan_file": ".claude/specs/{ticket-id}-impl.md",
      "context_file": ".claude/specs/{ticket-id}-context.md",
      "spec_review_file": ".claude/specs/{ticket-id}-review-spec.md",
      "impl_review_file": ".claude/specs/{ticket-id}-review-impl.md"
    },
```

With:

```json
    "spec": {
      "completed": false,
      "spec_file": ".claude/specs/{ticket-id}.md",
      "impl_plan_file": ".claude/specs/{ticket-id}-impl.md",
      "context_file": ".claude/specs/{ticket-id}-context.md",
      "spec_review_iterations": 0,
      "impl_review_iterations": 0
    },
```

**Verification:**
- `spec_review_file` and `impl_review_file` should NOT appear anywhere in the file
- `spec_review_iterations` and `impl_review_iterations` should appear in `stages.spec`

**Commit:**
```bash
git add plugins/full-orchestration/skills/swe/SKILL.md
git commit -m "fix(swe): replace review file paths with iteration counters in spec stage state"
```

---

### Task 5: Update 10-data-models-and-context.md

Remove review doc artifacts, add iteration count fields, update the artifact map and context flow diagram. This is the largest doc update.

**Files:**
- Modify: `plugins/full-orchestration/docs/10-data-models-and-context.md`

**Changes (in order of appearance):**

1. **Full Schema** (lines 28-34) — Replace the `stages.spec` block:

From:
```json
    "spec": {
      "completed": false,
      "spec_file": ".claude/specs/PROJ-123.md",
      "impl_plan_file": ".claude/specs/PROJ-123-impl.md",
      "context_file": ".claude/specs/PROJ-123-context.md",
      "spec_review_file": ".claude/specs/PROJ-123-review-spec.md",
      "impl_review_file": ".claude/specs/PROJ-123-review-impl.md"
    },
```

To:
```json
    "spec": {
      "completed": false,
      "spec_file": ".claude/specs/PROJ-123.md",
      "impl_plan_file": ".claude/specs/PROJ-123-impl.md",
      "context_file": ".claude/specs/PROJ-123-context.md",
      "spec_review_iterations": 0,
      "impl_review_iterations": 0
    },
```

2. **Section "2C — Spec Review"** (around line 307-311) — Replace:

From:
```markdown
### 2C — Spec Review

**Path**: `.claude/specs/{ticket-id}-review-spec.md`
**Producer**: `spec_review` skill (consolidates 4 reviewer outputs)
**Consumer**: `spec_writer` (presents to user)
```

To:
```markdown
### 2C — Spec Review (Inline Comments)

**Producer**: `spec_review` skill (4 reviewers insert inline comments into `{ticket-id}.md`)
**Consumer**: `spec_writer` (counts OPEN comments, spawns SpecArchitect to address them)

No separate review file. Reviewers insert blockquote comments directly into the spec:

```
> **[{SEVERITY} | {ReviewerName} | OPEN]** {comment text}
```

After the review-fix loop converges (0 OPEN comments or 5 rounds), `spec_writer` strips all remaining RESOLVED markers before presenting to the user.
```

3. **Section "2E — Implementation Plan Review"** (around line 313-317) — Replace:

From:
```markdown
### 2E — Implementation Plan Review

**Path**: `.claude/specs/{ticket-id}-review-impl.md`
**Producer**: `spec_review` skill (same skill, different mode)
**Consumer**: `spec_writer` (presents to user)
```

To:
```markdown
### 2E — Implementation Plan Review (Inline Comments)

**Producer**: `spec_review` skill (same skill, impl mode — reviewers insert inline comments into `{ticket-id}-impl.md`)
**Consumer**: `spec_writer` (counts OPEN comments, spawns ImplPlanner to address them)

Same inline comment mechanics as 2C. No separate review file.
```

4. **Remove the "Consolidated Review Format" block** (around lines 319-345) — Delete the entire section from `#### Consolidated Review Format (shared by 2C and 2E)` through the `**Verdict logic**` line.

5. **Remove "Review Context File (ephemeral)" section** (around lines 348-375) — Delete the entire section.

6. **Update "Reviewer Agents" section** — Change tools from `Read, Grep` to `Read, Grep, Edit` in the table:

From:
```
| MaintainabilityReviewer | ... | sonnet | Sustainability | ... |
| SecurityReviewer | ... | sonnet | Attack surface | ... |
| EfficiencyReviewer | ... | sonnet | Performance | ... |
| CompletenessReviewer | ... | sonnet | Coverage | ... |
```

Add Edit to each agent's implied tools.

7. **Update "Persistent Files" in the artifact map** (around lines 789-795) — Remove the 3 review doc rows:

Remove:
```
| `.claude/specs/{ticket-id}-review-spec.md` | spec_review (2C) | `spec_writer` (user presentation) | Entire pipeline |
| `.claude/specs/{ticket-id}-review-impl.md` | spec_review (2E) | `spec_writer` (user presentation) | Entire pipeline |
| `.claude/swe-state/{ticket-id}/review-context.md` | `spec_review` | 4 reviewer agents | Stage 2 onward |
```

8. **Update "Context Flow Diagram"** (around lines 818-824) — Replace the Stage 2 review lines:

From:
```
                            ├─ 2C: spec_review ──► review-spec.md
                            │       (reads review-context.md)
```

To:
```
                            ├─ 2B↔2C: review-fix loop (inline comments in spec.md)
```

And similarly for 2E:

From:
```
                            └─ 2E: spec_review ──► review-impl.md
                                    (reads review-context.md)
```

To:
```
                            └─ 2D↔2E: review-fix loop (inline comments in impl.md)
```

9. **Update "Agent Summary" table** — Change reviewer tools from `Read, Grep` to `Read, Grep, Edit`.

10. **Update "User Approval Gates" table** (around lines 873-882) — Replace the 4 Stage 2 gates:

From:
```
| 2B | After spec | Technical spec | Approve / Request changes |
| 2C | After spec review | Consolidated review findings | Approve / Update spec + re-review |
| 2D | After impl plan | Implementation plan | Approve / Request changes |
| 2E | After plan review | Consolidated review findings | Approve / Update plan + re-review |
```

To:
```
| 2B↔2C | After spec review-fix loop | Clean spec (review comments resolved and stripped) | Approve / Request changes |
| 2D↔2E | After impl plan review-fix loop | Clean impl plan (review comments resolved and stripped) | Approve / Request changes |
```

**Verification:**
- `spec_review_file` and `impl_review_file` should NOT appear in the file
- `review-spec.md` and `review-impl.md` paths should NOT appear in the artifact map
- `review-context.md` should NOT appear in the persistent files section
- `spec_review_iterations` and `impl_review_iterations` should appear in the schema
- Reviewer agents should show `Read, Grep, Edit` tools
- User approval gates should show 2 Stage 2 gates (not 4)

**Commit:**
```bash
git add plugins/full-orchestration/docs/10-data-models-and-context.md
git commit -m "docs(data-models): update for inline comment review loops, remove separate review artifacts"
```

---

### Task 6: Update 02-spec-design.md

Update the collaboration flow diagram, sub-stage descriptions, dependency order table, and spec storage section.

**Files:**
- Modify: `plugins/full-orchestration/docs/02-spec-design.md`

**Changes:**

1. **Section "2C: Spec Review"** (lines 150-212) — Replace the entire section with:

```markdown
### 2C: Spec Review (Autonomous Loop with 2B)

Once the spec is generated, it enters an autonomous review-fix loop managed by `spec_writer`. Four reviewer agents insert inline comments directly into the spec document, then `SpecArchitect` addresses them. This repeats until convergence (0 OPEN comments) or 5 rounds.

#### Inline Comment Format

Reviewers insert blockquote comments directly into the spec:

```
> **[{SEVERITY} | {ReviewerName} | OPEN]** {comment text}
```

Placed immediately after the relevant paragraph or section.

#### Review-Fix Cycle

1. `spec_review` spawns 4 reviewers in parallel → each inserts OPEN comments into the spec
2. If 0 OPEN comments → converged
3. `SpecArchitect` reads comments, fixes the spec, marks addressed comments RESOLVED
4. On re-review, reviewers verify RESOLVED comments (remove satisfied ones, reopen inadequate ones) and add new OPEN comments
5. Repeat until converged or 5 rounds

After convergence, `spec_writer` strips all remaining RESOLVED comment markers.

#### User Interaction

After the loop completes, the user sees a clean spec (no review markers). If the loop hit the cap with OPEN comments remaining, those are shown separately.

The user can:
- **Approve** → proceed to 2D
- **Request changes** → provide direction, re-enter the loop
```

2. **Section "2E: Implementation Doc Review"** (lines 273-294) — Replace the entire section with:

```markdown
### 2E: Implementation Doc Review (Autonomous Loop with 2D)

The same review-fix loop from 2B↔2C runs on the implementation document, with `ImplPlanner` as the author agent instead of `SpecArchitect`.

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

After the loop completes, the user sees a clean implementation plan. This is the last gate before Stage 3 begins.
```

3. **"Collaboration Flow" diagram** (lines 322-365) — Replace with:

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
    ├── 2B: SpecArchitect produces Technical Spec
    │
    ├── 2B↔2C: Autonomous Review-Fix Loop (max 5 rounds)
    │         │  spec_review inserts inline comments
    │         │  SpecArchitect addresses comments
    │         │  (repeat until 0 OPEN or cap)
    │         │  Strip RESOLVED markers
    │         ▼
    │       User reviews clean spec
    │       ├── Request changes → re-enter loop
    │       └── Approves → proceed
    │
    ├── 2D: ImplPlanner produces Implementation Doc
    │
    ├── 2D↔2E: Autonomous Review-Fix Loop (max 5 rounds)
    │         │  spec_review inserts inline comments
    │         │  ImplPlanner addresses comments
    │         │  (repeat until 0 OPEN or cap)
    │         │  Strip RESOLVED markers
    │         ▼
    │       User reviews clean impl doc
    │       ├── Request changes → re-enter loop
    │       └── Approves → proceed to Stage 3
    │
    ▼
Spec + Impl Doc stored, Stage 3 begins
```

4. **"Dependency Order" table** (lines 369-386) — Replace with updated version that removes the separate review file outputs and adds loop iterations:

```markdown
## Dependency Order

| Step | Component | Inputs Required | Produced By | Output |
|---|---|---|---|---|
| 2A | Explore subagents (parallel) | `ticket.json` | Stage 1 | — |
| 2A | spec-writer (merge) | Explorer outputs | 2A explorers | `.claude/specs/{ticket-id}-context.md` |
| 2B | SpecArchitect | `ticket.json`, `{ticket-id}-context.md` | Stage 1, 2A | `.claude/specs/{ticket-id}.md` |
| 2B↔2C | spec_review + SpecArchitect (loop) | `{ticket-id}.md`, `ticket.json`, `{ticket-id}-context.md` | 2B, Stage 1, 2A | Inline comments in `{ticket-id}.md` (then stripped) |
| — | User approval gate | Clean `{ticket-id}.md` | 2B↔2C loop | — |
| 2D | ImplPlanner | `{ticket-id}.md`, `{ticket-id}-context.md` | 2B, 2A | `.claude/specs/{ticket-id}-impl.md` |
| 2D↔2E | spec_review + ImplPlanner (loop) | `{ticket-id}-impl.md`, `ticket.json`, `{ticket-id}-context.md` | 2D, Stage 1, 2A | Inline comments in `{ticket-id}-impl.md` (then stripped) |
| — | Final user approval gate | Clean `{ticket-id}-impl.md` | 2D↔2E loop | — |
```

5. **"Spec Storage" table** (lines 397-409) — Remove the two review file rows:

Remove:
```
| `.claude/specs/{ticket-id}-review-spec.md` | Consolidated spec review from 2C |
| `.claude/specs/{ticket-id}-review-impl.md` | Consolidated impl doc review from 2E |
```

Update the spec and impl descriptions:
```
| `.claude/specs/{ticket-id}.md` | Approved Technical Spec from 2B (reviewed via 2B↔2C loop) |
| `.claude/specs/{ticket-id}-impl.md` | Approved Implementation Doc from 2D (reviewed via 2D↔2E loop) |
```

**Verification:**
- `review-spec.md` and `review-impl.md` should NOT appear anywhere
- `2B↔2C` and `2D↔2E` should appear in section headers
- Collaboration flow should show 2 user gates (not 4)
- Spec Storage should list 3 files (not 5)

**Commit:**
```bash
git add plugins/full-orchestration/docs/02-spec-design.md
git commit -m "docs(spec-design): update for autonomous inline comment review-fix loops"
```

---

### Task 7: Update 00-overview.md Stage 2 description

**Files:**
- Modify: `plugins/full-orchestration/docs/00-overview.md`

**Change** the Stage 2 description in the "Pipeline Flow" section (around line 77). Replace:

```markdown
2. **Spec & Design** — An explorer team fans out across the codebase to identify affected areas. The spec architect synthesizes findings into a technical spec. A review team of four specialists (maintainability, security, efficiency, completeness) evaluates the spec. An implementation planner produces a step-by-step build plan. A final review validates the plan.
```

With:

```markdown
2. **Spec & Design** — An explorer team fans out across the codebase to identify affected areas. The spec architect synthesizes findings into a technical spec. Four specialist reviewers (maintainability, security, efficiency, completeness) insert inline comments directly into the spec, and the spec architect addresses them in an autonomous loop (up to 5 rounds). An implementation planner produces a step-by-step build plan, which goes through the same review-fix loop. The user sees only the final clean documents.
```

**Verification:**
- Should contain "inline comments" and "autonomous loop"
- Should mention "5 rounds"

**Commit:**
```bash
git add plugins/full-orchestration/docs/00-overview.md
git commit -m "docs(overview): update Stage 2 description for inline comment review loops"
```

---

### Task 8: Update 07-plugin-components.md

Update descriptions for `spec_writer`, `spec_review`, and the 4 reviewer agents.

**Files:**
- Modify: `plugins/full-orchestration/docs/07-plugin-components.md`

**Changes:**

1. **spec_writer description** (around line 141) — Replace:

```markdown
**Body contains:** Instructions for orchestrating the five sub-stages of Stage 2: (2A) spawning 3-5 explorer subagents to map affected codebase areas, (2B) invoking the SpecArchitect agent to synthesize findings into a technical spec, (2C) running the 4-agent review team via spec-review on the spec, (2D) invoking the ImplPlanner agent to produce a step-by-step plan, (2E) running the review team again on the implementation plan. Handles iteration if reviewers request changes.
```

With:

```markdown
**Body contains:** Instructions for orchestrating Stage 2: (2A) spawning 3-5 explorer subagents, (2B) invoking SpecArchitect to produce a spec, (2B↔2C) running an autonomous review-fix loop where 4 reviewers insert inline comments and SpecArchitect addresses them (max 5 rounds), (2D) invoking ImplPlanner to produce a step-by-step plan, (2D↔2E) running the same review-fix loop with ImplPlanner as author. Strips resolved comment markers before presenting clean docs to the user.
```

2. **spec_review frontmatter and description** (around lines 147-159) — Replace:

```yaml
---
name: spec_review
description: >-
  Run a four-agent adversarial review on a technical spec or
  implementation plan. Use when a spec or plan needs evaluation
  from maintainability, security, efficiency, and completeness
  perspectives. Spawns four reviewer agents in parallel and
  consolidates their findings into a single assessment.
---
```

With:

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

And replace the body description:

```markdown
**Body contains:** Instructions for spawning the four reviewer agents (maintainability, security, efficiency, completeness) as parallel subagents, collecting their individual findings, consolidating results into a single structured assessment with severity ratings, and determining whether the document passes review or needs revision.
```

With:

```markdown
**Body contains:** Instructions for spawning four reviewer agents in parallel, each using Edit to insert inline blockquote comments (`> **[SEVERITY | Reviewer | OPEN]**`) directly into the document under review. Counts OPEN comments by severity and reports to the caller. No separate review document is produced.
```

3. **Reviewer agent descriptions** (around lines 283-340) — Update "Tools used" for all four:

From `**Tools used:** Read (...), Grep (...)` to `**Tools used:** Read (...), Grep (...), Edit (to insert inline review comments into the document).`

Also update "Behavior" for all four — append: `Inserts findings as inline blockquote comments directly into the document under review.`

**Verification:**
- `spec_review` description should mention "inline comment" and "OPEN blockquote"
- `spec_writer` body description should mention "2B↔2C" and "2D↔2E"
- All 4 reviewer agents should list Edit in their tools

**Commit:**
```bash
git add plugins/full-orchestration/docs/07-plugin-components.md
git commit -m "docs(components): update spec_writer, spec_review, and reviewer agent descriptions for inline comments"
```

---

## Task Dependency Summary

Tasks 1-4 can be done in any order (they modify independent files). Tasks 5-8 are documentation updates that can also be done independently.

Suggested execution order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 (follows the data flow: agents → skills → state → docs).
