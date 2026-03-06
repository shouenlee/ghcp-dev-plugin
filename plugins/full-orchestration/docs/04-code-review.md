# 04 — Code Review

## Purpose

Stage 4 subjects the implementation from [Stage 3](03-tdd-implementation.md) to adversarial, multi-perspective code review. Multiple review agents examine the diff independently, surface issues from different angles, and produce a consolidated assessment. The orchestrator then drives an iteration loop — auto-fixing minor issues, escalating major ones, and re-reviewing until the changes are approved or the user intervenes.

The goal: catch bugs, security holes, and architectural missteps **before** they reach a human reviewer in the PR.

---

## Options

| Option | Approach | Pros | Cons | Recommendation |
|--------|----------|------|------|----------------|
| **A** | Reuse `deep-review` plugin | Battle-tested agents; consistent with standalone usage; zero additional skill authoring | Less control over review criteria | **Recommended** |
| **B** | Custom review team | Full control over prompts and review focus areas | Duplicates existing work; maintenance burden | Use only if review needs diverge significantly |
| **C** | Sequential reviews | One reviewer at a time; lower cost per run | Slower wall-clock time; reviewers cannot cross-reference each other | Use for budget-constrained runs |

Option A is the default. The orchestrator delegates to the [`deep-review`](../../deep-review/skills/deep_review/SKILL.md) plugin, which already implements parallel three-agent review with synthesis.

---

## deep-review Plugin Integration

The `deep-review` plugin spawns three agents in parallel, each reading a shared context file:

| Agent | Role | Focus |
|-------|------|-------|
| **Skeptic** (opus) | Find flaws | Bugs, edge cases, failure modes, code smells that indicate deeper problems |
| **Advocate** (opus) | Defend intent | Design rationale, trust boundaries, false-positive defense, flags genuine uncertainties |
| **Architect** | Evaluate direction | System-level impact, structural patterns, technical debt trajectory |

Each agent produces an independent analysis. The orchestrator (within `deep-review`) synthesizes these into a consolidated review using evidence-based conflict resolution — `file:line` citations beat assertions.

For full details on how context is gathered, agents are spawned, and synthesis works, see the [deep-review skill documentation](../../deep-review/skills/deep_review/SKILL.md).

---

## Review Loop: Three-Phase Architecture

```
┌──────────────────────────────────────┐
│  Phase A: Initial Full Review         │
│  git diff {target}...{feature}       │
│  /deep_review (full branch diff)     │
└──────────────┬───────────────────────┘
               │
        ┌──────┴──────┐
        │             │
   No findings    Findings
        │             │
        │      ┌──────┴──────────┐
        │      │ Critical?       │
        │      │ YES → ask user  │
        │      │ NO  → auto-fix  │
        │      └──────┬──────────┘
        │             │
        │      ┌──────┴──────────┐
        │      │ TddEngineer     │
        │      │ applies fixes   │
        │      │ records snapshot│
        │      └──────┬──────────┘
        │             │
        ▼             ▼
┌──────────────────────────────────────┐
│  Phase B: Incremental Fix Loop       │◄────────────┐
│  git diff {snapshot}...HEAD          │             │
│  /deep_review (fix changes only)     │             │
└──────────────┬───────────────────────┘             │
               │                                     │
        ┌──────┴──────┐                              │
        │             │                              │
   Converged     Findings                            │
   (0 C/M/Mi)        │                              │
        │      ┌──────┴──────────┐                   │
        │      │ Critical → user │                   │
        │      │ Major → auto-fix│                   │
        │      │ Minor → auto-fix│                   │
        │      └──────┬──────────┘                   │
        │             │                              │
        │      TddEngineer fixes                     │
        │             │                              │
        │      iteration < 5? ─── Yes ───────────────┘
        │             │
        │          No (capped)
        │             │
        ▼             ▼
┌──────────────────────────────────────┐
│  Phase C: Final Validation Review     │
│  git diff {target}...{feature}       │
│  /deep_review (full branch diff)     │
│  Compare vs Phase A findings          │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Approval Gate (always)               │
│  User: approve / iterate / abort     │
└──────────────────────────────────────┘
```

### Phase details

1. **Phase A — Initial full review**: The orchestrator runs `/deep_review` against the complete branch diff. Critical findings pause for user input. Major and Minor findings are auto-fixed by the TDD engineer. A git snapshot is recorded after fixes.
2. **Phase B — Incremental fix loop**: Subsequent iterations review only the diff since the last snapshot (fix changes only). The loop converges when a re-review returns 0 Critical + 0 Major + 0 Minor findings. Max 5 total iterations (including Phase A). If capped without convergence, proceeds to Phase C with a warning.
3. **Phase C — Final validation**: One last full-branch review catches interaction bugs that incremental reviews missed. Findings are compared to Phase A to identify regressions vs persistent issues. Does not re-enter the auto-fix loop — any remaining Critical/Major are presented at the approval gate.
4. **Approval gate**: Always reached. User sees iteration count, findings breakdown (resolved, auto-fixed, dismissed, remaining), and test status. User chooses approve, iterate (back to Phase B with direction), or abort.

---

## Severity Rating System

All findings are classified into one of four severity levels:

| Severity | Meaning | Action |
|----------|---------|--------|
| **Critical** | Must fix before merge | Security vulnerabilities, data loss risks, correctness bugs with user-facing impact |
| **Major** | Should fix | Logic errors, missing error handling, race conditions, broken edge cases |
| **Minor** | Nice to fix | Naming inconsistencies, style deviations, minor performance optimizations |
| **Suggestion** | Consider for future | Refactoring ideas, alternative approaches, patterns that could improve maintainability |

### How severities drive the loop

- **Critical** findings break the auto-loop. The orchestrator pauses immediately and presents Critical findings for user decision: fix (with direction), dismiss (with rationale), or abort. Dismissed Criticals are recorded in state.
- **Major** findings are auto-fixed by the TDD engineer. No user input required — the re-review in subsequent iterations validates the fix.
- **Minor** findings are auto-fixed. If auto-fix fails, they are demoted to suggestions.
- **Suggestions** are collected into a "Follow-up Items" section and do not block convergence.

---

## Security Reviewer (Recommended Addition)

> **Note:** The `full-orchestration` plugin already includes a `SecurityReviewer` agent used during spec and plan review (Stage 2). This section recommends adding a security-focused reviewer to the `deep-review` plugin for *code-level* review in Stage 4.

For security-sensitive changes, consider adding a fourth reviewer focused on security. This agent would check for:

- **OWASP Top 10** — injection, broken authentication, sensitive data exposure, XXE, broken access control, security misconfiguration, XSS, insecure deserialization, vulnerable components, insufficient logging
- **Injection risks** — SQL injection, command injection, path traversal, template injection
- **Secrets exposure** — hardcoded credentials, API keys in source, secrets in logs or error messages
- **Dependency vulnerabilities** — known CVEs in dependencies, outdated packages with security patches
- **Authentication and authorization** — missing auth checks, privilege escalation paths, insecure token handling

This can be implemented as an additional agent in the `deep-review` plugin or as a standalone review step that runs before the main review cycle. When adding a security agent, it should have veto power: any security finding rated Critical automatically blocks the review.

---

## Approval Gate

After the three-phase review completes, the orchestrator **always** presents a summary and waits for explicit user approval before proceeding to [Stage 5: PR Creation](05-pr-creation.md).

The approval prompt includes:
- Iterations completed and phase reached (converged / capped / validation findings)
- Findings breakdown: resolved, auto-fixed, remaining, dismissed (with rationale)
- Follow-up items (suggestions collected across all phases)
- Confirmation that all tests still pass after review fixes

User chooses:
- **Approve** — proceed to Stage 5
- **Iterate** — spawn TDD engineer with full context + user direction, return to Phase B
- **Abort** — stop pipeline

---

## Cross-References

- [deep-review plugin](../../deep-review/skills/deep_review/SKILL.md) — the review engine used in this stage
- [Stage 3: TDD Implementation](03-tdd-implementation.md) — produces the diff that gets reviewed; TDD engineer handles review fixes
- [Stage 5: PR Creation](05-pr-creation.md) — consumes the approved review output
- [00 — System Overview](00-overview.md) — full pipeline architecture
