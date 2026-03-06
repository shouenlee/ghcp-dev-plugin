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

## Review Iteration Loop

```
┌─────────────────────────────────┐
│  Generate diff from branch       │
│  (git diff main...feature)      │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Invoke /deep_review on diff    │
│  (3 agents in parallel)         │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Collect & consolidate feedback │
│  Assign severity ratings        │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Present findings to user       │◄──────────────┐
└──────────────┬──────────────────┘               │
               │                                  │
        ┌──────┴──────┐                           │
        │             │                           │
   No issues     Issues found                     │
        │             │                           │
        ▼             ▼                           │
   Approved    ┌──────────────┐                   │
               │ Auto-fix     │                   │
               │ minor issues │                   │
               │              │                   │
               │ Present major│                   │
               │ issues for   │                   │
               │ user decision│                   │
               └──────┬───────┘                   │
                      │                           │
                      ▼                           │
               ┌──────────────┐                   │
               │ TDD engineer │                   │
               │ re-implements│                   │
               │ fixes        │                   │
               └──────┬───────┘                   │
                      │                           │
                      ▼                           │
               Iteration < 3? ─── Yes ────────────┘
                      │
                      No
                      │
                      ▼
               User decides:
               approve / force-merge / abort
```

### Iteration steps

1. **Spawn review agents** — The orchestrator invokes `/deep_review` against the current diff between the feature branch and the target branch.
2. **Collect feedback** — Each agent's raw analysis is preserved, then consolidated into a structured review document with severity ratings.
3. **Present findings** — The user sees the consolidated review with all findings categorized by severity.
4. **Fix cycle** — If changes are needed:
   - **Minor issues** (naming, style, small optimizations) are auto-fixed by the orchestrator or TDD engineer without user intervention.
   - **Major and critical issues** are presented to the user, who decides whether to fix, defer, or dismiss each one.
5. **TDD engineer re-implements** — Accepted fixes go back to the [Stage 3 TDD engineer](03-tdd-implementation.md), who applies them while keeping tests green.
6. **Re-review** — The updated diff is sent through another review cycle (max 3 iterations).
7. **Final decision** — If issues persist after 3 iterations, the user chooses: approve as-is, continue iterating manually, or abort.

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

- **Critical** findings block approval. The iteration loop continues until they are resolved or the user explicitly overrides.
- **Major** findings are presented for user decision. The user can accept the fix, defer to a follow-up ticket, or dismiss with rationale.
- **Minor** findings are auto-fixed when possible. If auto-fix fails, they are presented as suggestions.
- **Suggestions** are collected into a "Follow-up Items" section in the review output and optionally included in the PR description.

---

## Security Reviewer (Recommended Addition)

For security-sensitive changes, consider adding a fourth reviewer focused on security. This agent would check for:

- **OWASP Top 10** — injection, broken authentication, sensitive data exposure, XXE, broken access control, security misconfiguration, XSS, insecure deserialization, vulnerable components, insufficient logging
- **Injection risks** — SQL injection, command injection, path traversal, template injection
- **Secrets exposure** — hardcoded credentials, API keys in source, secrets in logs or error messages
- **Dependency vulnerabilities** — known CVEs in dependencies, outdated packages with security patches
- **Authentication and authorization** — missing auth checks, privilege escalation paths, insecure token handling

This can be implemented as an additional agent in the `deep-review` plugin or as a standalone review step that runs before the main review cycle. When adding a security agent, it should have veto power: any security finding rated Critical automatically blocks the review.

---

## Approval Gate

After the review loop completes (either all issues resolved or user override), the orchestrator presents the final review summary and waits for explicit user approval before proceeding to [Stage 5: PR Creation](05-pr-creation.md).

The approval prompt includes:
- Final consolidated review with all findings and their resolutions
- List of any deferred or dismissed issues
- Confirmation that all tests still pass after review fixes

---

## Cross-References

- [deep-review plugin](../../deep-review/skills/deep_review/SKILL.md) — the review engine used in this stage
- [Stage 3: TDD Implementation](03-tdd-implementation.md) — produces the diff that gets reviewed; TDD engineer handles review fixes
- [Stage 5: PR Creation](05-pr-creation.md) — consumes the approved review output
- [00 — System Overview](00-overview.md) — full pipeline architecture
