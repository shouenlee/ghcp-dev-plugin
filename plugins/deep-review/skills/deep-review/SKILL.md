---
name: deep-review
description: One-shot adversarial review - three parallel subagents analyze independently, orchestrator synthesizes. No debate between agents. Fast and cost-effective.
---

# Deep Review

Perform thorough code review using three parallel agents with opposing mindsets.

## Why This Works

Single-reviewer blind spots miss issues.
Three perspectives create productive tension:

- **Advocate** - "Why is this correct?" Trust boundaries, design rationale, false-positive defense
- **Skeptic** - "How can I break this?" Bugs, edge cases, code smells that indicate bugs
- **Architect** - "Is this the right direction?" System impact, scope vs correctness, structural smells

Their disagreement surfaces issues.
Their agreement signals confidence.

## Usage

```
/deep-review                    # Review uncommitted local changes
/deep-review <PR-ID>            # Review a pull request
/deep-review <commit>           # Review a specific commit
/deep-review <file1> <file2>    # Review specific files
```

---

## Workflow

```
Phase 1: GATHER CONTEXT (you, the orchestrator)
    ├── Collect change information
    ├── Fetch file contents
    └── Write to /tmp/deep-review-${CLAUDE_SESSION_ID}-context.yaml

Phase 2: PARALLEL ANALYSIS (three agents)
    ├── Verify context file exists
    ├── Spawn three agents in parallel
    └── Each reads context file independently

Phase 3: SYNTHESIS (you, the orchestrator)
    ├── Reconcile into final review
    └── Delete context file (always)
```

---

## Phase 1: Gather Context

### 1.1 Identify the Changes

Determine what's being reviewed:
- PR/MR from a remote repository
- Local uncommitted changes
- Specific commits
- Files provided by user

Use project-specific tools if available (check project CLAUDE.md).
Fall back to git commands: `git diff`, `git show`, `git log`.

### 1.2 Fetch Content

For each changed file, get the **new version** (what's being reviewed).
- Local files: Read directly
- Remote PRs: Use project-specific fetch scripts or APIs

### 1.3 Write Context File

Write the context file to: `/tmp/deep-review-${CLAUDE_SESSION_ID}-context.yaml`

**Use `/tmp` in bash - it maps to the system temp directory on all platforms.**
Do NOT create temp files in the source directory being reviewed.

```yaml
review:
  type: pr | local | commit | files
  id: <identifier if applicable>
  title: <summary>
  description: <details>

changed_files:
  - path: <relative path>
    action: add | edit | delete | rename
    content: |
      <full file content - new version>

existing_feedback:               # optional
  - author: <who>
    location: <file:line or general>
    comment: <text>

observations:                    # your notes
  - <anything notable>
```

**Large changes**: If total content exceeds ~50KB, summarize less-critical files or split into multiple reviews.

### 1.4 Verify Context File

Before Phase 2, confirm the file exists:

```bash
test -f "$CONTEXT_FILE" && echo "Ready" || echo "ERROR: Context file missing"
```

Do NOT spawn agents if the context file doesn't exist.

---

## Phase 2: Parallel Analysis

Spawn THREE agents in a SINGLE message using the Task tool.
Agents do NOT inherit conversation history - the context file is their only input.

### 2.1 Agent Prompts

Agent instructions: [agents/](../../agents/)

Find the plugin path first: `**/deep-review/agents/advocate.agent.md`

**[Advocate](../../agents/advocate.agent.md)**:
```
subagent_type: deep-review:Advocate
prompt: |
  You are the ADVOCATE in an adversarial code review.
  Read your instructions: {plugin-path}/agents/advocate.agent.md
  Read the context: {context-file-path}
```

**[Skeptic](../../agents/skeptic.agent.md)**:
```
subagent_type: deep-review:Skeptic
prompt: |
  You are the SKEPTIC in an adversarial code review.
  Read your instructions: {plugin-path}/agents/skeptic.agent.md
  Read the context: {context-file-path}
```

**[Architect](../../agents/architect.agent.md)**:
```
subagent_type: deep-review:Architect
prompt: |
  You are the ARCHITECT in an adversarial code review.
  Read your instructions: {plugin-path}/agents/architect.agent.md
  Read the context: {context-file-path}
```

### 2.2 Handle Failures

If an agent fails or times out, offer user options:
- **Re-trigger** - spawn just that agent again
- **Proceed without** - continue with available results
- **Abort** - if critical perspective is missing

---

## Phase 3: Synthesis

### 3.1 Present Raw Perspectives

Show each agent's analysis in full before synthesizing.
This lets the user see raw reasoning and overrule if needed.

### 3.2 Agreement Analysis

What do multiple agents agree on?
High-confidence findings - include in final review.

### 3.3 Conflict Resolution

When agents disagree:

- Skeptic finds bug, Advocate defends
  → Does Advocate cite `file:line` that refutes? If not, Skeptic wins.
- Advocate says intentional, Skeptic says bug
  → If Skeptic shows reproducible path, it's a bug regardless of intent.
- Architect says blocking, Skeptic disagrees on priority
  → Use Skeptic's priority (they own correctness).
- Architect says blocking, Advocate defends
  → Architect wins on architectural concerns (they own direction).
- No evidence either way
  → Mark as "Disputed" for user to decide.

**Evidence beats assertion** - `file:line` wins over "probably."

### 3.4 Completeness Assessment

For large changes where agents could not examine everything, assess coverage honestly:

- **What was reviewed** - files, areas, and patterns agents examined
- **What was not reviewed** - files or areas agents skipped or only mentioned in passing
- **Confidence level** - HIGH (all significant paths examined), MEDIUM (representative sample), LOW (spot-checked only)

If agents focused heavily on some areas and ignored others, note the gap.
The user needs to know where the review is strong and where it's thin.

### 3.5 Final Review

```markdown
## Deep Review: <title>

### Summary
<1-2 sentence overview>

### Perspectives

**Author's Intent** (Advocate)
<key defenses and rationale>

**Risk Analysis** (Skeptic)
<bugs found, edge cases, concerns>

**Architectural Impact** (Architect)
<patterns, debt, direction>

### Consolidated Findings

- <issue>
  - **Priority**: Critical/High/Medium/Low
  - **Advocate**: <view>
  - **Skeptic**: <view>
  - **Architect**: <view>

### Disputed (if any)

- <issue>
  - **Advocate**: <defense>
  - **Skeptic/Architect**: <concern>
  - **Resolution**: User to decide

### Recommendations
<prioritized actions>

### Follow-up Items
<non-blocking concerns worth tracking>

### Coverage (if partial)
<what was reviewed, what was skipped, confidence level>
```

### 3.6 Cleanup (Always)

Delete the context file regardless of outcome:

```bash
rm -f "$CONTEXT_FILE"
```

Context file may contain sensitive code - always delete.

---

## Notes

- **Cost**: Spawns 3 parallel agents. Use for complex reviews.
- **Pre-existing bugs**: Agents may find issues in surrounding code. Include them.
- **Contradictions**: If agents find opposing evidence, include both views.
- **Failure recovery**: This plugin uses human-in-the-loop for failure recovery - on agent failure, the user chooses whether to re-trigger, proceed without, or abort.
  There are no automatic retry limits by design.
