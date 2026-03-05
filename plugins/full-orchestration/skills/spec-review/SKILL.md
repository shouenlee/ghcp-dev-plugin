---
name: spec-review
description: "Run a four-agent adversarial review on a technical spec or implementation plan. Use when a spec or plan needs evaluation from maintainability, security, efficiency, and completeness perspectives. Spawns four reviewer agents in parallel and consolidates their findings into a single assessment."
---

# Spec Review

Run four parallel reviewer agents to evaluate a spec or implementation plan from different perspectives.

## Usage

```
/spec-review <document-path>
```

Examples:
```
/spec-review .claude/specs/PROJ-123.md           # Review a technical spec (2C)
/spec-review .claude/specs/PROJ-123-impl.md      # Review an implementation plan (2E)
```

---

## Workflow

```
Phase 1: GATHER CONTEXT (you, the orchestrator)
    ├── Accept document path as argument
    ├── Detect document type (spec vs impl plan)
    ├── Read document + ticket + context doc
    └── Write context to /tmp/spec-review-${CLAUDE_SESSION_ID}-context.yaml

Phase 2: PARALLEL REVIEW (four agents)
    ├── Verify context file exists
    ├── Spawn four reviewer agents in SINGLE message
    └── Each reads context file and produces findings

Phase 3: CONSOLIDATION (you, the orchestrator)
    ├── Collect and group findings by severity
    ├── Deduplicate and note multi-reviewer agreement
    ├── Write consolidated review
    └── Cleanup context file
```

---

## Phase 1: Gather Context

### 1.1 Accept and Detect

The argument is a path to the document to review. Detect the type:

- **Spec**: path matches `{ticket-id}.md` (not `-impl.md`, not `-context.md`, not `-review-*.md`)
- **Impl plan**: path matches `{ticket-id}-impl.md`

Extract `{ticket-id}` from the filename.

Set the review mode:
- Spec → `review_mode: spec` (triggers 2C focus in reviewers)
- Impl plan → `review_mode: impl` (triggers 2E focus in reviewers)

### 1.2 Read Documents

Read these files:

1. **Document under review**: the path provided as argument
2. **Ticket**: `.claude/swe-state/{ticket-id}/ticket.json`
3. **Context document**: `.claude/specs/{ticket-id}-context.md`

If the ticket or context document doesn't exist, proceed with what's available — the document under review is the minimum requirement.

### 1.3 Write Context File

Set the context file path:
```
CONTEXT_FILE="/tmp/spec-review-${CLAUDE_SESSION_ID}-context.yaml"
```

Write the context file:

```yaml
review:
  document_path: <path to document under review>
  document_type: spec | impl
  review_mode: spec | impl
  ticket_id: <extracted ticket ID>

document_content: |
  <full content of document under review>

ticket: |
  <full content of ticket.json, or "Not available">

context: |
  <full content of context document, or "Not available">

instructions: |
  You are reviewing this document from your specialized perspective.
  Review mode is "{review_mode}" — use your corresponding review focus.
  Produce your findings in your standard output format.
  Reference specific sections, line numbers, or quotes from the document.
```

### 1.4 Verify Context File

Before Phase 2, confirm the file exists:

```bash
test -f "$CONTEXT_FILE" && echo "Ready" || echo "ERROR: Context file missing"
```

Do NOT spawn agents if the context file doesn't exist.

---

## Phase 2: Parallel Review

Spawn FOUR agents in a SINGLE message using the Agent tool. Each agent reads the context file independently.

Find the plugin path first: `**/full-orchestration/agents/*.agent.md`

**Maintainability Reviewer**:
```
subagent_type: full-orchestration:MaintainabilityReviewer
prompt: |
  You are the MAINTAINABILITY REVIEWER in a spec review.
  Read your instructions: {plugin-path}/agents/maintainability-reviewer.agent.md
  Read the review context: {context-file-path}
  Produce your review in the format specified in your instructions.
```

**Security Reviewer**:
```
subagent_type: full-orchestration:SecurityReviewer
prompt: |
  You are the SECURITY REVIEWER in a spec review.
  Read your instructions: {plugin-path}/agents/security-reviewer.agent.md
  Read the review context: {context-file-path}
  Produce your review in the format specified in your instructions.
```

**Efficiency Reviewer**:
```
subagent_type: full-orchestration:EfficiencyReviewer
prompt: |
  You are the EFFICIENCY REVIEWER in a spec review.
  Read your instructions: {plugin-path}/agents/efficiency-reviewer.agent.md
  Read the review context: {context-file-path}
  Produce your review in the format specified in your instructions.
```

**Completeness Reviewer**:
```
subagent_type: full-orchestration:CompletenessReviewer
prompt: |
  You are the COMPLETENESS REVIEWER in a spec review.
  Read your instructions: {plugin-path}/agents/completeness-reviewer.agent.md
  Read the review context: {context-file-path}
  Produce your review in the format specified in your instructions.
```

### Handle Failures

If an agent fails or times out, offer the user options:
- **Re-trigger** — spawn just that agent again
- **Proceed without** — continue with available results
- **Abort** — cancel the review

---

## Phase 3: Consolidation

### 3.1 Collect Results

Gather the four reviewer outputs. Each produces findings with severity ratings.

### 3.2 Group and Deduplicate

1. **Group by severity**: CRITICAL first, then HIGH, MEDIUM, LOW
2. **Deduplicate**: If multiple reviewers flag the same issue, merge into one finding and note agreement
3. **Note consensus**: Findings flagged by 2+ reviewers get a `[Multi-reviewer]` tag — these are high-confidence

### 3.3 Write Consolidated Review

Determine the output path based on review mode:
- Spec review → `.claude/specs/{ticket-id}-review-spec.md`
- Impl review → `.claude/specs/{ticket-id}-review-impl.md`

Write the consolidated review:

```markdown
# Consolidated Review: {ticket-id} ({spec|impl})

## Summary

| Severity | Count |
|---|---|
| CRITICAL | N |
| HIGH | N |
| MEDIUM | N |
| LOW | N |

**Verdict**: PASS | NEEDS REVISION

## CRITICAL Issues
<grouped findings — CRITICAL issues first>

## HIGH Issues
<grouped findings>

## MEDIUM Suggestions
<grouped findings>

## LOW Suggestions
<grouped findings>

## Reviewer Perspectives

### Maintainability
<summary of maintainability findings>

### Security
<summary of security findings>

### Efficiency
<summary of efficiency findings>

### Completeness
<summary of completeness findings>
```

### 3.4 Present Summary

Display to the user:

```
Spec Review Complete:
- N CRITICAL issues
- N HIGH issues
- N MEDIUM suggestions
- N LOW suggestions

Verdict: PASS / NEEDS REVISION

[Full review written to .claude/specs/{ticket-id}-review-{spec|impl}.md]
```

**Verdict logic:**
- **PASS**: Zero CRITICAL and zero HIGH findings
- **NEEDS REVISION**: Any CRITICAL or HIGH findings exist

### 3.5 Cleanup

Delete the context file regardless of outcome:

```bash
rm -f "$CONTEXT_FILE"
```

Context file may contain sensitive code — always delete.

---

## Notes

- **Cost**: Spawns 4 parallel agents. Each is sonnet-class (cost-effective).
- **Idempotent**: Can be re-run after spec changes to verify fixes.
- **Standalone**: Can be invoked independently via `/spec-review`, not just from `spec-writer`.
